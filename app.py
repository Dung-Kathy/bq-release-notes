import time
import logging
import requests
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for release notes
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 600  # 10 minutes cache by default

def map_header_to_category(header_text):
    """
    Maps release note section headers to standard categories.
    """
    h = header_text.strip().lower()
    if 'feature' in h:
        return 'Feature'
    elif 'change' in h:
        return 'Change'
    elif 'deprecation' in h or 'deprecated' in h:
        return 'Deprecation'
    elif 'fix' in h or 'resolved' in h:
        return 'Fix'
    elif 'security' in h:
        return 'Security'
    elif 'issue' in h:
        return 'Fix'
    return 'Announcement'

def extract_title_from_text(text, default_title):
    """
    Extracts a concise descriptive title from the release note text.
    """
    text = text.strip()
    # Remove leading category names
    text = re.sub(r'^(Feature|Change|Fix|Deprecation|Announcement|Notice|Security|Issue|Resolved):\s*', '', text, flags=re.IGNORECASE)
    
    if not text:
        return default_title
        
    # Get first line and clean it
    first_line = text.split('\n')[0].strip()
    first_line = re.sub(r'\s+', ' ', first_line) # Collapse multiple whitespaces
    
    # Try splitting by period to get first sentence
    sentences = first_line.split('. ')
    first_sentence = sentences[0].strip() if sentences else first_line
    
    # Trim and add period back if it's a short sentence and was truncated
    if len(first_sentence) < len(first_line) and not first_sentence.endswith('.'):
        first_sentence += '.'
        
    # Truncate to a reasonable title length
    if len(first_sentence) > 75:
        space_idx = first_sentence.rfind(' ', 0, 75)
        if space_idx != -1:
            first_sentence = first_sentence[:space_idx] + "..."
        else:
            first_sentence = first_sentence[:72] + "..."
            
    return first_sentence

def clean_html_content(html_content):
    """
    Cleans up HTML content, makes links secure and ensures formatting is clean.
    """
    if not html_content:
        return ""

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Make links open in new tab
    for link in soup.find_all('a'):
        link['target'] = '_blank'
        link['rel'] = 'noopener noreferrer'
        
    return str(soup)

def fetch_release_notes(force=False):
    """
    Fetches release notes from the RSS feed, parses the XML, and returns a list of notes.
    Splits multi-update days into separate updates.
    """
    now = time.time()
    if not force and cache["data"] is not None and (now - cache["last_fetched"]) < CACHE_DURATION:
        logger.info("Returning cached release notes")
        return cache["data"], False

    logger.info(f"Fetching release notes from feed: {FEED_URL}")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        all_updates = []
        for entry in root.findall('atom:entry', ns):
            title_elem = entry.find('atom:title', ns)
            updated_elem = entry.find('atom:updated', ns)
            id_elem = entry.find('atom:id', ns)
            content_elem = entry.find('atom:content', ns)
            link_elem = entry.find('atom:link', ns)
            
            title_date = title_elem.text if title_elem is not None else "BigQuery Update"
            updated = updated_elem.text if updated_elem is not None else ""
            entry_id = id_elem.text if id_elem is not None else ""
            raw_content = content_elem.text if content_elem is not None else ""
            
            link_url = ""
            if link_elem is not None:
                link_url = link_elem.attrib.get('href', '')
            if not link_url and entry_id.startswith('http'):
                link_url = entry_id

            # Parse and format date
            formatted_date = ""
            iso_date = ""
            if updated:
                try:
                    date_str = updated.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(date_str)
                    formatted_date = dt.strftime("%b %d, %Y")
                    iso_date = dt.isoformat()
                except Exception as e:
                    logger.error(f"Error parsing date {updated}: {e}")
                    formatted_date = title_date
                    iso_date = updated

            soup = BeautifulSoup(raw_content, 'html.parser')
            has_headers = soup.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) is not None
            
            if not has_headers:
                # Treat entire block as a single announcement
                content_html = clean_html_content(raw_content)
                desc_title = extract_title_from_text(soup.get_text(), title_date)
                
                # Check for category indicators in title or content
                category = "Announcement"
                text_lower = (desc_title + " " + soup.get_text()).lower()
                if 'feature' in text_lower:
                    category = "Feature"
                elif 'change' in text_lower:
                    category = "Change"
                elif 'deprecation' in text_lower or 'deprecated' in text_lower:
                    category = "Deprecation"
                elif 'fix' in text_lower or 'resolved' in text_lower:
                    category = "Fix"
                elif 'security' in text_lower:
                    category = "Security"

                all_updates.append({
                    'id': entry_id,
                    'title': desc_title,
                    'date': formatted_date,
                    'iso_date': iso_date,
                    'content': content_html,
                    'category': category,
                    'link': link_url
                })
                continue
            
            # Daily entry has headers splitting multiple updates
            current_category = "Announcement"
            current_elements = []
            
            # Count updates in this entry to create unique sub-IDs
            update_idx = 0
            
            for child in soup.contents:
                if child.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                    if current_elements:
                        # Process previous update
                        html_snippet = "".join(str(el) for el in current_elements)
                        text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text()
                        desc_title = extract_title_from_text(text_snippet, title_date)
                        content_html = clean_html_content(html_snippet)
                        
                        all_updates.append({
                            'id': f"{entry_id}#{update_idx}",
                            'title': desc_title,
                            'date': formatted_date,
                            'iso_date': iso_date,
                            'content': content_html,
                            'category': current_category,
                            'link': f"{link_url}#{current_category.lower()}" if link_url else ""
                        })
                        update_idx += 1
                        current_elements = []
                    
                    # Set up next update category
                    header_text = child.get_text().strip()
                    current_category = map_header_to_category(header_text)
                    
                elif child.name is not None or str(child).strip():
                    current_elements.append(child)
            
            # Don't forget the last update segment
            if current_elements:
                html_snippet = "".join(str(el) for el in current_elements)
                text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text()
                desc_title = extract_title_from_text(text_snippet, title_date)
                content_html = clean_html_content(html_snippet)
                
                all_updates.append({
                    'id': f"{entry_id}#{update_idx}",
                    'title': desc_title,
                    'date': formatted_date,
                    'iso_date': iso_date,
                    'content': content_html,
                    'category': current_category,
                    'link': f"{link_url}#{current_category.lower()}" if link_url else ""
                })

        # Cache the fetched data
        cache["data"] = all_updates
        cache["last_fetched"] = now
        logger.info(f"Successfully fetched, split and cached {len(all_updates)} release notes updates")
        return all_updates, True

    except Exception as e:
        logger.error(f"Failed to fetch release notes: {e}")
        if cache["data"] is not None:
            logger.info("Returning cached data as fallback after fetch failure")
            return cache["data"], False
        raise e


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases, is_new = fetch_release_notes(force=force)
        return jsonify({
            "status": "success",
            "count": len(releases),
            "data": releases,
            "cached": not is_new,
            "last_updated": datetime.fromtimestamp(cache["last_fetched"]).strftime("%Y-%m-%d %H:%M:%S")
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
