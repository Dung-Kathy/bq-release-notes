// State management
let releases = [];
let filteredReleases = [];
let currentCategory = 'all';
let searchQuery = '';
let sortOrder = 'newest';
let selectedRelease = null;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const retryBtn = document.getElementById('retry-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const sortSelect = document.getElementById('sort-select');
const filterChips = document.querySelectorAll('.chip');
const notesList = document.getElementById('notes-list');

const loadingContainer = document.getElementById('loading-container');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const emptyContainer = document.getElementById('empty-container');

// Status Panel Elements
const statusCacheBadge = document.getElementById('status-cache-badge');
const statusCount = document.getElementById('status-count');
const statusUpdated = document.getElementById('status-updated');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountSpan = document.getElementById('char-count');
const charCountWrapper = charCountSpan.closest('.char-count-wrapper');
const tweetTitlePreview = document.getElementById('tweet-title-preview');
const tweetDatePreview = document.getElementById('tweet-date-preview');
const tweetBadgeContainer = document.getElementById('tweet-badge-container');

// Toast Notification Element
const toast = document.getElementById('toast-notification');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme based on saved preference
    setupThemeToggle();
    fetchReleases();
    setupEventListeners();
});

// Theme toggle logic
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = toggleBtn.querySelector('.sun-icon');
    const moonIcon = toggleBtn.querySelector('.moon-icon');

    // Determine initial theme: saved preference > system preference > dark (default)
    const savedTheme = localStorage.getItem('theme');
    let theme;
    if (savedTheme) {
        theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme = 'light';
    } else {
        theme = 'dark';
    }

    applyTheme(theme);

    // Listen for OS-level theme changes (only if no saved preference)
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'light' : 'dark');
        }
    });

    // Toggle on click
    toggleBtn.addEventListener('click', () => {
        const isCurrentlyLight = document.body.classList.contains('light-theme');
        const newTheme = isCurrentlyLight ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    function applyTheme(themeName) {
        if (themeName === 'light') {
            document.body.classList.add('light-theme');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            toggleBtn.setAttribute('aria-label', 'Switch to dark theme');
            toggleBtn.title = 'Switch to Dark Theme';
        } else {
            document.body.classList.remove('light-theme');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            toggleBtn.setAttribute('aria-label', 'Switch to light theme');
            toggleBtn.title = 'Switch to Light Theme';
        }
    }
}

// Event Listeners setup
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => fetchReleases(true));
    
    // Retry button
    retryBtn.addEventListener('click', () => fetchReleases(true));
    
    // Search input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFiltersAndSort();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        applyFiltersAndSort();
    });
    
    // Sort dropdown
    sortSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        applyFiltersAndSort();
    });
    
    // Export CSV button
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    
    // Category chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category;
            applyFiltersAndSort();
        });
    });

    // Tweet Modal controls
    modalCloseBtn.addEventListener('click', closeTweetModal);
    modalCancelBtn.addEventListener('click', closeTweetModal);
    tweetSubmitBtn.addEventListener('click', submitTweet);
    tweetTextarea.addEventListener('input', updateCharCount);
    
    // Close modal when clicking outside
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.classList.contains('open')) {
            closeTweetModal();
        }
    });
}

// Fetch release notes from backend API
async function fetchReleases(force = false) {
    showLoading();
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;

    try {
        const response = await fetch(`/api/releases?refresh=${force}`);
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            releases = result.data;
            updateStatusPanel(result);
            applyFiltersAndSort();
        } else {
            throw new Error(result.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
    } finally {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

// Update the top status/info panel
function updateStatusPanel(result) {
    // Cache badge
    if (result.cached) {
        statusCacheBadge.className = 'badge badge-info';
        statusCacheBadge.textContent = 'Cached';
        statusCacheBadge.title = 'Loaded from server cache to save bandwidth. Click Refresh to reload.';
    } else {
        statusCacheBadge.className = 'badge badge-feature';
        statusCacheBadge.textContent = 'Live Feed';
        statusCacheBadge.title = 'Freshly fetched from Google Cloud.';
    }
    
    // Total Count
    statusCount.textContent = `${result.count} Updates`;
    
    // Updated timestamp
    statusUpdated.textContent = `Last Checked: ${result.last_updated.split(' ')[1] || result.last_updated}`;
}

// Filter and sort releases based on user selections
function applyFiltersAndSort() {
    // 1. Filter by category
    filteredReleases = releases;
    if (currentCategory !== 'all') {
        filteredReleases = filteredReleases.filter(item => 
            item.category.toLowerCase() === currentCategory.toLowerCase()
        );
    }
    
    // 2. Filter by search query
    if (searchQuery) {
        filteredReleases = filteredReleases.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(searchQuery);
            // Plain text search inside HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.content;
            const contentText = tempDiv.textContent || tempDiv.innerText || '';
            const contentMatch = contentText.toLowerCase().includes(searchQuery);
            return titleMatch || contentMatch;
        });
    }
    
    // 3. Sort by date
    filteredReleases.sort((a, b) => {
        const dateA = new Date(a.iso_date || a.date);
        const dateB = new Date(b.iso_date || b.date);
        
        if (sortOrder === 'newest') {
            return dateB - dateA;
        } else {
            return dateA - dateB;
        }
    });
    
    renderReleases();
}

// Render cards into the feed container
function renderReleases() {
    notesList.innerHTML = '';
    
    if (filteredReleases.length === 0) {
        showEmpty();
        return;
    }
    
    hideStates();
    
    filteredReleases.forEach((note, index) => {
        const card = document.createElement('article');
        card.className = 'release-card';
        // Add staggered animation delay
        card.style.animationDelay = `${Math.min(index * 0.05, 0.8)}s`;
        
        const badgeClass = `badge-${note.category.toLowerCase()}`;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="badge ${badgeClass}">${note.category}</span>
                    <span class="release-date">${note.date}</span>
                </div>
                <div class="card-actions">
                    <button class="card-btn card-btn-copy-text" title="Copy Content to Clipboard" data-id="${note.id}">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <button class="card-btn card-btn-copy" title="Copy Direct Link" data-link="${note.link}">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                    </button>
                    <button class="card-btn card-btn-tweet" title="Share on X" data-id="${note.id}">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span style="font-size: 0.8rem; font-weight: 500; margin-left: 4px;">Tweet</span>
                    </button>
                </div>
            </div>
            <h2>${note.title}</h2>
            <div class="card-content">
                ${note.content}
            </div>
        `;
        
        // Add copy content event listener
        const copyTextBtn = card.querySelector('.card-btn-copy-text');
        copyTextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const textContent = formatPlaintextRelease(note);
            copyToClipboard(textContent, 'Content copied to clipboard!');
        });
        
        // Add copy event listener
        const copyBtn = card.querySelector('.card-btn-copy');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const link = copyBtn.dataset.link;
            copyToClipboard(link);
        });
        
        // Add tweet event listener
        const tweetBtn = card.querySelector('.card-btn-tweet');
        tweetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTweetModal(note);
        });
        
        notesList.appendChild(card);
    });
}

// Format release note into readable plaintext
function formatPlaintextRelease(note) {
    const plainTextContent = stripHtml(note.content);
    return `[${note.date}] ${note.category}: ${note.title}\n\n${plainTextContent}\n\nLink: ${note.link}`;
}

// Copy text to clipboard
function copyToClipboard(text, successMessage = 'Link copied to clipboard!') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Show toast notification with custom message
function showToast(message = 'Link copied to clipboard!') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Helper to strip HTML tags for text excerpts
function stripHtml(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove strong/category prefix if it matches common release note headers
    let text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Remove leading category indicators commonly found in paragraphs, e.g. "Feature: "
    text = text.replace(/^(Feature|Change|Fix|Deprecation|Announcement|Notice|Security):\s*/i, '');
    
    return text.trim();
}

// Generate a clean text excerpt for the tweet
function generateExcerpt(html, maxLength = 110) {
    const text = stripHtml(html);
    if (text.length <= maxLength) return text;
    
    // Find last space within boundary
    let cutoff = text.lastIndexOf(' ', maxLength);
    if (cutoff === -1 || cutoff < maxLength / 2) {
        cutoff = maxLength;
    }
    return text.substring(0, cutoff) + '...';
}

// Tweet Modal logic
function openTweetModal(release) {
    selectedRelease = release;
    
    // Modal header updates
    tweetTitlePreview.textContent = release.title;
    tweetDatePreview.textContent = release.date;
    
    // Category badge update
    tweetBadgeContainer.innerHTML = `<span class="badge badge-${release.category.toLowerCase()}">${release.category}</span>`;
    
    // Construct default draft text
    // Twitter URL shortening standard counts any URL as 23 characters.
    // Length breakdown:
    // "🚀 BigQuery Update: " (20 chars)
    // "Title" (variable)
    // "\n\n" (2 chars)
    // "Excerpt" (variable, targeted around 100-110 chars)
    // "\n\nRead more: " (13 chars)
    // "Link" (23 chars on Twitter)
    // " #BigQuery #GoogleCloud" (23 chars)
    
    const intro = `🚀 BigQuery Update: ${release.title}\n\n`;
    const hashtags = `\n\n#BigQuery #GoogleCloud`;
    const linkText = `\nRead more: ${release.link}`;
    
    // Excerpt calculation: we have 280 total.
    // Intro length + hashtags (23) + linkText (12 + 23 = 35) = fixed length.
    // Excerpt can occupy the remaining space.
    const urlReplacementLength = 23;
    const fixedLength = intro.length + hashtags.length + 12 + urlReplacementLength;
    const remainingForExcerpt = 280 - fixedLength - 5; // buffer of 5
    
    const excerpt = generateExcerpt(release.content, Math.max(50, remainingForExcerpt));
    const defaultTweet = `${intro}${excerpt}${linkText}${hashtags}`;
    
    tweetTextarea.value = defaultTweet;
    updateCharCount();
    
    tweetModal.classList.add('open');
    tweetTextarea.focus();
    // Position cursor at start of excerpt or end of text
    tweetTextarea.setSelectionRange(intro.length, intro.length + excerpt.length);
}

function closeTweetModal() {
    tweetModal.classList.remove('open');
    selectedRelease = null;
}

// Smart Twitter character counter
// X/Twitter counts all links as exactly 23 characters, regardless of actual length.
function calculateTweetLength(text) {
    if (!selectedRelease || !selectedRelease.link) {
        return text.length;
    }
    
    const url = selectedRelease.link;
    // Find occurrences of the release link in the text and replace them with a 23-char placeholder
    // We also handle other URLs in case they typed any, but focusing on the main release link.
    const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedUrl, 'g');
    
    // Replace the specific link with a 23-char mock URL
    let calculatedText = text.replace(regex, 'x'.repeat(23));
    
    // Also find any other standard http/https URLs in the text and count them as 23 characters
    const generalUrlRegex = /https?:\/\/[^\s]+/g;
    calculatedText = calculatedText.replace(generalUrlRegex, (match) => {
        // If it's already the replaced link, keep it as is, otherwise count it as 23 chars
        return match.includes('x'.repeat(23)) ? match : 'x'.repeat(23);
    });
    
    return calculatedText.length;
}

function updateCharCount() {
    const text = tweetTextarea.value;
    const length = calculateTweetLength(text);
    
    charCountSpan.textContent = length;
    
    // Style classes based on length limits
    charCountWrapper.classList.remove('warning', 'error');
    tweetSubmitBtn.disabled = false;
    
    if (length > 280) {
        charCountWrapper.classList.add('error');
        tweetSubmitBtn.disabled = true;
    } else if (length > 250) {
        charCountWrapper.classList.add('warning');
    }
}

function submitTweet() {
    const text = tweetTextarea.value;
    const length = calculateTweetLength(text);
    
    if (length > 280) {
        alert('Tweet exceeds the 280 character limit!');
        return;
    }
    
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
}

// UI State Switchers
function showLoading() {
    hideStates();
    loadingContainer.style.display = 'block';
    notesList.style.opacity = '0.3';
}

function showError(message) {
    hideStates();
    errorContainer.style.display = 'block';
    errorMessage.textContent = message || 'Could not connect to the BigQuery feed.';
    notesList.style.display = 'none';
}

function showEmpty() {
    hideStates();
    emptyContainer.style.display = 'block';
    notesList.style.display = 'none';
}

function hideStates() {
    loadingContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    emptyContainer.style.display = 'none';
    notesList.style.display = 'flex';
    notesList.style.opacity = '1';
}

// Export currently filtered and sorted release notes to CSV
function exportToCSV() {
    if (filteredReleases.length === 0) {
        alert("No release notes available to export.");
        return;
    }
    
    // CSV Headers
    const headers = ["ID", "Title", "Date", "ISO Date", "Category", "Link", "Plaintext Content"];
    
    // Escape values for CSV output
    function escapeCSV(val) {
        if (val === null || val === undefined) return '';
        let str = val.toString();
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
            str = `"${str}"`;
        }
        return str;
    }
    
    // Map notes to CSV rows
    const rows = filteredReleases.map(note => {
        const plainContent = stripHtml(note.content);
        return [
            note.id,
            note.title,
            note.date,
            note.iso_date,
            note.category,
            note.link,
            plainContent
        ].map(escapeCSV).join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Create download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Dynamic file name based on category filters and date
    const catName = currentCategory.toLowerCase();
    const queryName = searchQuery ? `_${searchQuery.replace(/[^a-z0-9]/gi, '_')}` : '';
    const dateStr = new Date().toISOString().split('T')[0];
    
    link.setAttribute("download", `bigquery_releases_${catName}${queryName}_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
