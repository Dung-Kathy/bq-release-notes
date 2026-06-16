# BigQuery Release Notes Explorer

## Screenshot

![App screenshot](screenshots/app.png)

A premium, interactive web application built with Python Flask and plain vanilla HTML, JavaScript, and CSS that fetches the official Google BigQuery Release Notes feed, parses and structures it, and displays it in a beautiful, modern interface. It also includes an advanced Twitter/X sharing mechanism.

## Features

- **Split Update Parser**: Instead of rendering multiple unrelated updates in a single daily card, the backend automatically splits daily entries into individual, discrete release notes with custom-generated descriptive titles.
- **Smart Category Mapping**: Automatically parses the HTML content and headings to group updates into standard categories: `Feature`, `Change`, `Fix`, `Deprecation`, `Security`, and `Announcement`.
- **Advanced X (Twitter) Generator**: 
  - Allows selecting any specific update to draft a customized tweet.
  - Features a custom character counter that accurately mimics X's 23-character URL shortening limit for links.
  - Disables publishing and warns the user when the character count exceeds the 280-character limit.
- **Real-Time Client-side Filtering & Search**:
  - Live text search that matches against the release note title and plaintext content (HTML tags stripped).
  - Clean filter chips with HSL colors and animated hover states for categorization.
  - Sorting between newest and oldest first.
- **Robust Caching & Live Syncing**:
  - Employs a 10-minute in-memory caching system on the server to optimize loading speeds.
  - Clicking the **Refresh** button triggers a live fetch (`/api/releases?refresh=true`) bypassing cache, complete with a rotating spinner animation.
- **Utility Tooling**:
  - **Copy Content Button**: Copy a cleanly-formatted plaintext representation of the release note date, title, content, and source link directly to the clipboard.
  - **Copy Link Button**: Copy the direct deep link to the source update on Google Cloud.
  - **Export CSV Button**: Instantly download the currently filtered and sorted release notes as a clean, properly-escaped CSV file with custom descriptive filenames.
- **Rich Modern Aesthetics**:
  - Glassmorphic panels with blur and backdrop filters (`backdrop-filter`).
  - Animated floating background glowing blobs and an overlay grid.
  - Custom brand-colored badges for release types.
  - Staggered fade-and-slide entrance animations for release cards.

## Project Structure

```
bq-release-notes/
├── app.py                 # Flask server with feed parsing and cache management
├── requirements.txt       # Python dependencies (Flask, requests, bs4)
├── README.md              # Project documentation
├── templates/
│   └── index.html         # Main page template (responsive markup & SVG assets)
└── static/
    ├── css/
    │   └── style.css      # Custom styling, animations, colors and modal layouts
    └── js/
        └── app.js         # Frontend controller, search/filter pipeline, X integration
```

## Setup & Running Instructions

### 1. Prerequisites
Ensure you have Python 3.8+ and pip installed.

### 2. Install Dependencies
Navigate to the root directory and install requirements:
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Launch the Flask development server:
```bash
python app.py
```
By default, the server runs on [http://127.0.0.1:5000](http://127.0.0.1:5000).

### 4. Interactive Usage
1. Open your web browser and go to `http://127.0.0.1:5000`.
2. Click **Refresh** to load the release notes feed. You'll see the spinner rotate, and once loaded, updates will slide into view.
3. Use the search input or filter chips (Features, Changes, etc.) to query updates.
4. Click the **Link** icon on any card to copy its direct deep link to the clipboard.
5. Click the **Copy Content** icon on any card to copy the full formatted plaintext update (including date, category, title, description, and source link).
6. Click **Export CSV** next to the sorting select to download a CSV file of the currently filtered and sorted updates.
7. Click **Tweet** on any card to open the tweet modal, customize your post, and click **Post** to publish it on X.
