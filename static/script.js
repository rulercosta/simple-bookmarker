/**
 * Simple Bookmarks App - iOS-Style
 * Using Dexie.js for IndexedDB handling
 */

class BookmarksDB {
  constructor() {
    this.db = new Dexie('BookmarksDB');
    this.initDB();
  }

  initDB() {
    this.db.version(2).stores({
      bookmarks: '++id, url, title, createdAt, *tags'
    });
  }

  async addBookmark({ url, title, tags = [] }) {
    return await this.db.bookmarks.add({
      url,
      title,
      tags: tags.filter(tag => tag.trim() !== ''),
      createdAt: new Date()
    });
  }

  async updateBookmark(id, data) {
    return await this.db.bookmarks.update(id, data);
  }

  async deleteBookmark(id) {
    return await this.db.bookmarks.delete(id);
  }

  async getBookmark(id) {
    return await this.db.bookmarks.get(id);
  }

  async getAllBookmarks() {
    return await this.db.bookmarks.toArray();
  }

  async searchBookmarks(query) {
    return await this.db.bookmarks
      .filter(bookmark => 
        bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
      .toArray();
  }
}

// App initialization
const db = new BookmarksDB();
let selectedBookmark = null;
let currentTag = null;

// DOM Elements
const elements = {
  bookmarksContainer: document.getElementById('bookmarks-container'),
  emptyState: document.getElementById('empty-state'),
  addButton: document.getElementById('add-button'),
  searchInput: document.getElementById('search-input'),
  bookmarkModal: document.getElementById('bookmark-modal'),
  contextMenu: document.getElementById('context-menu'),
  modalOverlay: document.getElementById('modal-overlay'),
  bookmarkForm: document.getElementById('bookmark-form'),
  toastContainer: document.getElementById('toast-container'),
  mainContent: document.querySelector('.main-content'),
  navBar: document.querySelector('.nav-bar'),
  body: document.body,
  viewSelector: document.getElementById('view-selector'),
  segmentAll: document.getElementById('segment-all'),
  segmentTags: document.getElementById('segment-tags'),
  segmentSelector: document.querySelector('.segment-selector'),
  allView: document.getElementById('all-view'),
  tagsView: document.getElementById('tags-view'),
  tagsContainer: document.getElementById('tags-container'),
  tagsEmptyState: document.getElementById('tags-empty-state'),
  footer: document.getElementById('ios-footer'),
  footerCount: document.getElementById('footer-count')
};

// Event Listeners
elements.addButton.addEventListener('click', showAddBookmarkModal);
elements.searchInput.addEventListener('input', handleSearch);
elements.bookmarkForm.addEventListener('submit', handleBookmarkSubmit);

// Initialize the app
async function initApp() {
  await loadBookmarks();
  
  // Set up context menu
  setupContextMenu();
  
  // Setup segmented control
  setupSegmentedControl();
  
  // Clicking outside context menu should close it
  document.addEventListener('click', () => {
    hideContextMenu();
  });
  
  // Add modal close handler
  document.getElementById('modal-cancel').addEventListener('click', hideBookmarkModal);
  
  // Add modal overlay click handler
  elements.modalOverlay.addEventListener('click', hideBookmarkModal);
  
  // Setup iOS-like gestures for modal dismissal
  setupModalGestures();

  // Initialize the segment selector position
  initializeSegmentSelector();

  // Load previously selected view from localStorage
  loadSelectedView();
}

// Initialize the segmented control appearance
function initializeSegmentSelector() {
  // Set initial position for the segment selector
  const activeSegment = elements.viewSelector.querySelector('.segment.selected');
  if (activeSegment) {
    positionSegmentSelector(activeSegment);
  }
}

// Set up segmented control behavior
function setupSegmentedControl() {
  const segments = document.querySelectorAll('.segment');
  
  segments.forEach(segment => {
    segment.addEventListener('click', () => {
      // Don't do anything if this segment is already selected
      if (segment.classList.contains('selected')) {
        return;
      }
      
      // Remove selected class from all segments
      segments.forEach(s => s.classList.remove('selected'));
      
      // Add selected class to clicked segment
      segment.classList.add('selected');
      
      // Position the selector
      positionSegmentSelector(segment);
      
      // Show the associated view
      const viewId = segment.dataset.view;
      switchView(viewId);
      
      // Save the selected view preference
      localStorage.setItem('selectedView', viewId);
    });
  });
}

// Position the selector under the active segment
function positionSegmentSelector(activeSegment) {
  const segmentIndex = Array.from(activeSegment.parentNode.children).indexOf(activeSegment);
  const segmentWidth = 100 / elements.viewSelector.querySelectorAll('.segment').length;
  
  elements.segmentSelector.style.width = `${segmentWidth}%`;
  elements.segmentSelector.style.transform = `translateX(${segmentIndex * 100}%)`;
}

// Switch between views
function switchView(viewId) {
  // Hide all views
  const views = document.querySelectorAll('.view-container');
  views.forEach(view => view.classList.remove('active'));
  
  // Show the selected view
  document.getElementById(viewId).classList.add('active');
  
  // Handle specific view logic
  if (viewId === 'tags-view') {
    loadBookmarks(); // This will now update both bookmarks and tags
  }
  
  updateFooterCount(); // Add this line
}

// Load the previously selected view from localStorage
function loadSelectedView() {
  const savedView = localStorage.getItem('selectedView');
  
  if (savedView) {
    const viewSegment = document.querySelector(`.segment[data-view="${savedView}"]`);
    
    if (viewSegment) {
      // Programmatically click the segment to restore the view
      viewSegment.click();
    }
  }
}

// Setup iOS-like gesture handling for modal dismissal
function setupModalGestures() {
  const modal = elements.bookmarkModal;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  modal.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, button')) return; // Don't interfere with form inputs
    const touch = e.touches[0];
    startY = touch.clientY;
    currentY = startY;
    isDragging = true;
  });

  modal.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    currentY = touch.clientY;
    
    const deltaY = currentY - startY;
    if (deltaY > 0) { // Only allow dragging down
      e.preventDefault();
      modal.style.transform = `translateY(${deltaY}px)`;
      
      // Adjust opacity of overlay based on drag distance
      const maxDrag = window.innerHeight * 0.25;
      const opacity = 1 - Math.min(deltaY / maxDrag, 1) * 0.5;
      elements.modalOverlay.style.opacity = opacity;
    }
  });

  modal.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    const deltaY = currentY - startY;
    const threshold = window.innerHeight * 0.2; // 20% of screen height
    
    if (deltaY > threshold) {
      // If dragged down past threshold, dismiss modal
      hideBookmarkModal();
    } else {
      // Otherwise, snap back to original position
      modal.style.transform = '';
      elements.modalOverlay.style.opacity = '';
    }
  });
}

// Load and render bookmarks
async function loadBookmarks() {
  const bookmarks = await db.getAllBookmarks();
  if (currentTag) {
    const filtered = bookmarks.filter(bookmark => 
      bookmark.tags && bookmark.tags.includes(currentTag)
    );
    renderBookmarks(filtered);
    updateTagsView(bookmarks); // Keep tags view updated
  } else {
    renderBookmarks(bookmarks);
    updateTagsView(bookmarks);
  }
}

// Render bookmarks
function renderBookmarks(bookmarks) {
  elements.bookmarksContainer.innerHTML = '';
  
  if (bookmarks.length === 0) {
    elements.emptyState.classList.add('visible');
  } else {
    elements.emptyState.classList.remove('visible');
    
    bookmarks.forEach(bookmark => {
      const bookmarkElement = createBookmarkElement(bookmark);
      elements.bookmarksContainer.appendChild(bookmarkElement);
    });
  }
  
  updateFooterCount(); // Add this line
}

// Create bookmark element
function createBookmarkElement(bookmark) {
  const div = document.createElement('div');
  div.className = 'bookmark-item';
  div.dataset.id = bookmark.id;
  
  // Try to get a favicon, with fallback
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${bookmark.url}&sz=64`;
  
  let tagsHtml = '';
  if (bookmark.tags && bookmark.tags.length > 0) {
    tagsHtml = `
      <div class="bookmark-tags">
        ${bookmark.tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}
      </div>
    `;
  }
  
  div.innerHTML = `
    <div class="bookmark-content">
      <div class="favicon">
        <img src="${faviconUrl}" alt="favicon" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <div class="fallback-icon material-icons" style="display:none;">public</div>
      </div>
      <div class="bookmark-info">
        <h3>${escapeHtml(bookmark.title)}</h3>
        <p>${new URL(bookmark.url).hostname}</p>
        ${tagsHtml}
      </div>
    </div>
  `;

  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, bookmark);
  });
  
  div.addEventListener('click', () => {
    window.open(bookmark.url, '_blank');
  });
  
  return div;
}

// Helper function to escape HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Setup context menu functionality
function setupContextMenu() {
  document.getElementById('context-edit').addEventListener('click', () => {
    if (selectedBookmark) {
      editBookmark(selectedBookmark);
    }
    hideContextMenu();
  });
  
  document.getElementById('context-copy').addEventListener('click', () => {
    if (selectedBookmark) {
      navigator.clipboard.writeText(selectedBookmark.url)
        .then(() => showToast('URL copied to clipboard'))
        .catch(() => showToast('Failed to copy URL'));
    }
    hideContextMenu();
  });
  
  document.getElementById('context-delete').addEventListener('click', () => {
    if (selectedBookmark) {
      deleteBookmark(selectedBookmark.id);
    }
    hideContextMenu();
  });
}

// Show context menu
function showContextMenu(e, bookmark) {
  e.preventDefault();
  e.stopPropagation();
  selectedBookmark = bookmark;
  
  const menu = elements.contextMenu;
  menu.classList.add('visible');
  
  // Position the menu
  const x = Math.min(e.pageX, window.innerWidth - menu.offsetWidth - 10);
  const y = Math.min(e.pageY, window.innerHeight - menu.offsetHeight - 10);
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

// Hide context menu
function hideContextMenu() {
  elements.contextMenu.classList.remove('visible');
}

// Handle search
async function handleSearch(e) {
  const query = e.target.value;
  const bookmarks = query ? 
    await db.searchBookmarks(query) :
    await db.getAllBookmarks();
  renderBookmarks(bookmarks);
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  
  // Make visible with animation
  setTimeout(() => toast.classList.add('visible'), 10);
  
  // Auto-remove after delay
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Modal handling with blur effects
function showAddBookmarkModal() {
  resetBookmarkForm();
  document.getElementById('modal-title').textContent = 'Add Bookmark';
  
  // Update save button - icon only
  const saveBtn = document.getElementById('modal-save');
  saveBtn.innerHTML = '<span class="material-icons">save</span>';
  
  // Apply blur class to the main content and navigation
  elements.mainContent.classList.add('ios-blur');
  elements.navBar.classList.add('ios-blur');
  
  // Properly animate modal appearance
  elements.modalOverlay.style.display = 'block';
  elements.bookmarkModal.style.display = 'flex';
  
  // Force reflow before adding visible class for animation
  void elements.modalOverlay.offsetWidth;
  void elements.bookmarkModal.offsetWidth;
  
  elements.modalOverlay.classList.add('visible');
  elements.bookmarkModal.classList.add('visible');
  
  // Disable scrolling on the body
  elements.body.style.overflow = 'hidden';
  
  // Focus on the first field after animation
  setTimeout(() => {
    elements.bookmarkForm.elements['bookmark-url'].focus();
  }, 300); // Match animation duration
}

function hideBookmarkModal() {
  // Start animations to hide modal
  elements.bookmarkModal.classList.remove('visible');
  elements.modalOverlay.classList.remove('visible');
  
  // Remove iOS-style blur effect
  elements.mainContent.classList.remove('ios-blur');
  elements.navBar.classList.remove('ios-blur');
  
  // Remove transforms if they were set by gesture
  elements.bookmarkModal.style.transform = '';
  elements.modalOverlay.style.opacity = '';
  
  // After animation completes, reset display properties
  setTimeout(() => {
    elements.modalOverlay.style.display = 'none';
    elements.bookmarkModal.style.display = 'none';
    
    // Re-enable scrolling
    elements.body.style.overflow = '';
  }, 300); // Match the CSS transition duration
}

// Reset bookmark form
function resetBookmarkForm() {
  elements.bookmarkForm.reset();
}

// Edit a bookmark
function editBookmark(bookmark) {
  selectedBookmark = bookmark;
  
  // Fill form with bookmark data
  const form = elements.bookmarkForm;
  form.elements['bookmark-url'].value = bookmark.url;
  form.elements['bookmark-title'].value = bookmark.title;
  form.elements['bookmark-tags'].value = bookmark.tags ? bookmark.tags.join(', ') : '';
  
  // Update modal title
  document.getElementById('modal-title').textContent = 'Edit Bookmark';
  
  // Update save button to show "update" icon - icon only
  const saveBtn = document.getElementById('modal-save');
  saveBtn.innerHTML = '<span class="material-icons">update</span>';
  
  // Apply blur class to the main content and navigation
  elements.mainContent.classList.add('ios-blur');
  elements.navBar.classList.add('ios-blur');
  
  // Properly animate modal appearance
  elements.modalOverlay.style.display = 'block';
  elements.bookmarkModal.style.display = 'flex';
  
  // Force reflow before adding visible class
  void elements.modalOverlay.offsetWidth;
  void elements.bookmarkModal.offsetWidth;
  
  elements.modalOverlay.classList.add('visible');
  elements.bookmarkModal.classList.add('visible');
  
  // Disable scrolling on the body
  elements.body.style.overflow = 'hidden';
  
  // Focus on the title field after animation - more logical for edit
  setTimeout(() => {
    elements.bookmarkForm.elements['bookmark-title'].focus();
  }, 300); // Match animation duration
}

// Delete a bookmark
async function deleteBookmark(id) {
  try {
    await db.deleteBookmark(id);
    showToast('Bookmark deleted successfully');
    currentTag = null; // Reset tag filter when deleting
    loadBookmarks();
  } catch (error) {
    showToast('Error deleting bookmark');
  }
}

async function handleBookmarkSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  try {
    // Process tags
    const tagsString = formData.get('bookmark-tags');
    const tags = tagsString
      ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
      : [];
    
    const bookmarkData = {
      url: formData.get('bookmark-url'),
      title: formData.get('bookmark-title'),
      tags
    };
    
    // Validate URL
    try {
      new URL(bookmarkData.url);
    } catch (urlError) {
      showToast('Please enter a valid URL (include http:// or https://)');
      return;
    }
    
    if (selectedBookmark) {
      // Update existing bookmark
      await db.updateBookmark(selectedBookmark.id, bookmarkData);
      showToast('Bookmark updated successfully');
      selectedBookmark = null;
    } else {
      // Add new bookmark
      await db.addBookmark(bookmarkData);
      showToast('Bookmark added successfully');
    }
    
    loadBookmarks(); // This will now update both bookmarks and tags
    hideBookmarkModal();
  } catch (error) {
    showToast('Error saving bookmark');
  }
}

// Close context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!elements.contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

// Add new function to get unique tags and their counts
function getTagsWithCounts(bookmarks) {
  const tagCount = new Map();
  tagCount.set('All', bookmarks.length); // Add "All" option with total count
  
  bookmarks.forEach(bookmark => {
    if (bookmark.tags) {
      bookmark.tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    }
  });
  
  return tagCount;
}

// Add new function to update tags view
async function updateTagsView(bookmarks) {
  const tagsContainer = document.getElementById('tags-container');
  const tagsEmptyState = document.getElementById('tags-empty-state');
  
  const tagCount = getTagsWithCounts(bookmarks);
  
  if (tagCount.size <= 1) { // Only has "All" tag
    tagsContainer.innerHTML = '';
    tagsEmptyState.classList.add('visible');
    return;
  }
  
  tagsEmptyState.classList.remove('visible');
  
  const tagsHtml = Array.from(tagCount.entries())
    .map(([tag, count]) => `
      <div class="tag-item ${currentTag === tag ? 'active' : ''}" data-tag="${tag}">
        <span class="tag-name">${escapeHtml(tag)}</span>
        <span class="tag-count">${count}</span>
      </div>
    `)
    .join('');
  
  tagsContainer.innerHTML = tagsHtml;
  
  // Add click handlers
  document.querySelectorAll('.tag-item').forEach(tagItem => {
    tagItem.addEventListener('click', () => {
      const tag = tagItem.dataset.tag;
      
      // If clicking the same tag again or clicking "All", remove filter
      if (currentTag === tag || tag === 'All') {
        currentTag = null;
      } else {
        currentTag = tag;
      }
      
      // Switch to All view when tag is selected
      if (elements.segmentAll) {
        elements.segmentAll.click();
      }
      
      loadBookmarks();
    });
  });
  
  updateFooterCount(); // Add this line
}

// Add this new function
function updateFooterCount() {
  let count = 0;
  
  // Get currently active view
  const activeView = document.querySelector('.view-container.active');
  
  if (activeView.id === 'all-view') {
    // Count visible bookmark items
    count = activeView.querySelectorAll('.bookmark-item').length;
    elements.footerCount.textContent = `${count} bookmark${count !== 1 ? 's' : ''}`;
  } else if (activeView.id === 'tags-view') {
    // Count visible tag items (excluding the "All" tag)
    count = activeView.querySelectorAll('.tag-item').length;
    count = Math.max(0, count - 1); // Subtract 1 to exclude the "All" tag
    elements.footerCount.textContent = `${count} tag${count !== 1 ? 's' : ''}`;
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);

// Theme toggle functionality
document.getElementById('theme-toggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark-theme');
  const themeIcon = document.getElementById('theme-icon');
  
  if (document.documentElement.classList.contains('dark-theme')) {
    themeIcon.textContent = 'light_mode';
    localStorage.setItem('theme', 'dark');
    window.currentTheme = 'dark';
  } else {
    themeIcon.textContent = 'dark_mode';
    localStorage.setItem('theme', 'light');
    window.currentTheme = 'light';
  }
});