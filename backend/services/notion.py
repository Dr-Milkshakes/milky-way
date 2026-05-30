from notion_client import Client
from config import settings
from database import supabase
import logging

logger = logging.getLogger(__name__)
notion = Client(auth=settings.notion_api_key)


def extract_text_from_blocks(blocks: list) -> str:
    """Recursively extract plain text from Notion block content."""
    text_parts = []
    for block in blocks:
        block_type = block.get("type")
        if not block_type:
            continue
        content = block.get(block_type, {})
        # Rich text blocks
        if "rich_text" in content:
            for rt in content["rich_text"]:
                text_parts.append(rt.get("plain_text", ""))
        # Recurse into children
        if block.get("has_children"):
            try:
                children = notion.blocks.children.list(block_id=block["id"])
                text_parts.append(extract_text_from_blocks(children["results"]))
            except Exception:
                pass
    return "\n".join(filter(None, text_parts))


def get_page_text(page_id: str) -> str:
    """Get all text content from a Notion page."""
    try:
        blocks = notion.blocks.children.list(block_id=page_id)
        return extract_text_from_blocks(blocks["results"])
    except Exception as e:
        logger.error(f"Failed to get page text for {page_id}: {e}")
        return ""


def get_property_text(prop: dict) -> str:
    """Extract text value from a Notion property."""
    prop_type = prop.get("type")
    if prop_type == "title":
        parts = prop.get("title", [])
    elif prop_type == "rich_text":
        parts = prop.get("rich_text", [])
    elif prop_type == "select":
        sel = prop.get("select")
        return sel.get("name", "") if sel else ""
    elif prop_type == "multi_select":
        return ", ".join(s["name"] for s in prop.get("multi_select", []))
    elif prop_type == "rollup":
        rollup = prop.get("rollup", {})
        array = rollup.get("array", [])
        # Extract text from each item in the rollup array
        values = []
        for item in array:
            values.append(get_property_text(item))
        return ", ".join(filter(None, values))
    elif prop_type == "formula":
        formula = prop.get("formula", {})
        return str(formula.get("string") or formula.get("number") or "")
    else:
        return ""
    return "".join(p.get("plain_text", "") for p in parts)


def sync_notion_database() -> dict:
    """
    Pull all pages from the Notion database and upsert into Supabase topics table.
    Returns a summary of what was synced.
    """
    try:
        response = notion.databases.query(database_id=settings.notion_database_id)
        pages = response["results"]

        # Handle pagination
        while response.get("has_more"):
            response = notion.databases.query(
                database_id=settings.notion_database_id,
                start_cursor=response["next_cursor"]
            )
            pages.extend(response["results"])

        synced = 0
        failed = 0

        for page in pages:
            try:
                props = page["properties"]

                # Get title from "Topic Name" property (relation)
                title = ""
                subject = ""
                
                # Title — try "Topic Name" as rich_text/title, else fallback
                for prop_name, prop_val in props.items():
                    if prop_val["type"] == "title":
                        title = get_property_text(prop_val)
                    if prop_name == "Topic Name" and prop_val["type"] == "rich_text":
                        title = get_property_text(prop_val)

                if not title:
                    # Use page title as fallback
                    title = page.get("properties", {}).get("Topic Name", {}).get("title", [{}])
                    if isinstance(title, list) and title:
                        title = title[0].get("plain_text", "Untitled")
                    else:
                        title = "Untitled"

                # Subject — direct select property
                course_prop = props.get("Course", {})
                if course_prop.get("type") == "select" and course_prop.get("select"):
                    subject = course_prop["select"]["name"]

                # Content — fetch from "Topic Article" relation
                content = ""
                topic_article_prop = props.get("Topic Article", {})
                if topic_article_prop.get("type") == "relation":
                    related_articles = topic_article_prop.get("relation", [])
                    article_texts = []
                    for article_ref in related_articles:
                        article_id = article_ref["id"]
                        try:
                            article_content = get_page_text(article_id)
                            if article_content:
                                article_texts.append(article_content)
                        except Exception:
                            pass
                    content = "\n\n".join(article_texts)
                
                # Fallback — get content from the topic page itself
                if not content:
                    content = get_page_text(page["id"])

                if not title or title == "Untitled":
                    continue

                # Upsert into Supabase
                supabase.table("topics").upsert({
                    "notion_page_id": page["id"],
                    "title": title,
                    "subject": subject or "General",
                    "content": content,
                    "last_synced_at": "now()"
                }, on_conflict="notion_page_id").execute()

                synced += 1
                logger.info(f"Synced topic: {title}")

            except Exception as e:
                logger.error(f"Failed to sync page {page.get('id')}: {e}")
                failed += 1

        return {
            "total_pages": len(pages),
            "synced": synced,
            "failed": failed
        }

    except Exception as e:
        logger.error(f"Notion sync failed: {e}")
        raise


def get_subjects() -> list[str]:
    """Return distinct subjects from synced topics."""
    result = supabase.table("topics").select("subject").execute()
    return list({row["subject"] for row in result.data if row["subject"]})
