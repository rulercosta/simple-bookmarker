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

const db = new BookmarksDB();
let selectedBookmark = null;
let currentTag = null;

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

elements.addButton.addEventListener('click', showAddBookmarkModal);
elements.searchInput.addEventListener('input', handleSearch);
elements.bookmarkForm.addEventListener('submit', handleBookmarkSubmit);

async function initApp() {
  await loadBookmarks();
  setupContextMenu();
  setupSegmentedControl();
  updateLayoutHeights();
  
  window.addEventListener('resize', updateLayoutHeights);
  
  document.addEventListener('click', () => {
    hideContextMenu();
  });
  
  document.getElementById('modal-cancel').addEventListener('click', hideBookmarkModal);
  
  elements.modalOverlay.addEventListener('click', hideBookmarkModal);
  
  setupModalGestures();

  initializeSegmentSelector();

  loadSelectedView();
}

function updateLayoutHeights() {
  const navHeight = elements.navBar.offsetHeight;
  const bottomHeight = document.querySelector('.bottom-controls').offsetHeight;
  
  document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
  document.documentElement.style.setProperty('--bottom-height', `${bottomHeight}px`);
}

function initializeSegmentSelector() {
  const activeSegment = elements.viewSelector.querySelector('.segment.selected');
  if (activeSegment) {
    positionSegmentSelector(activeSegment);
  }
}

function setupSegmentedControl() {
  const segments = document.querySelectorAll('.segment');
  
  segments.forEach(segment => {
    segment.addEventListener('click', () => {
      if (segment.classList.contains('selected')) {
        return;
      }
      
      segments.forEach(s => s.classList.remove('selected'));
      
      segment.classList.add('selected');
      
      positionSegmentSelector(segment);
      
      const viewId = segment.dataset.view;
      switchView(viewId);
      
      localStorage.setItem('selectedView', viewId);
    });
  });
}

function positionSegmentSelector(activeSegment) {
  const segmentIndex = Array.from(activeSegment.parentNode.children).indexOf(activeSegment);
  const segmentWidth = 100 / elements.viewSelector.querySelectorAll('.segment').length;
  
  elements.segmentSelector.style.width = `${segmentWidth}%`;
  elements.segmentSelector.style.transform = `translateX(${segmentIndex * 100}%)`;
}

function switchView(viewId) {
  const views = document.querySelectorAll('.view-container');
  views.forEach(view => view.classList.remove('active'));
  
  document.getElementById(viewId).classList.add('active');
  
  if (viewId === 'tags-view') {
    loadBookmarks(); 
  }
  
  updateFooterCount(); 
}

function loadSelectedView() {
  const savedView = localStorage.getItem('selectedView');
  
  if (savedView) {
    const viewSegment = document.querySelector(`.segment[data-view="${savedView}"]`);
    
    if (viewSegment) {
      viewSegment.click();
    }
  }
}

function setupModalGestures() {
  const modal = elements.bookmarkModal;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  modal.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, button')) return; 
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
    if (deltaY > 0) { 
      e.preventDefault();
      modal.style.transform = `translateY(${deltaY}px)`;
      
      const maxDrag = window.innerHeight * 0.25;
      const opacity = 1 - Math.min(deltaY / maxDrag, 1) * 0.5;
      elements.modalOverlay.style.opacity = opacity;
    }
  });

  modal.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    const deltaY = currentY - startY;
    const threshold = window.innerHeight * 0.2; 
    
    if (deltaY > threshold) {
      hideBookmarkModal();
    } else {
      modal.style.transform = '';
      elements.modalOverlay.style.opacity = '';
    }
  });
}

async function loadBookmarks() {
  const bookmarks = await db.getAllBookmarks();
  if (currentTag) {
    const filtered = bookmarks.filter(bookmark => 
      bookmark.tags && bookmark.tags.includes(currentTag)
    );
    renderBookmarks(filtered);
    updateTagsView(bookmarks); 
  } else {
    renderBookmarks(bookmarks);
    updateTagsView(bookmarks);
  }
}

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
  
  updateFooterCount(); 
}

function createBookmarkElement(bookmark) {
  const div = document.createElement('div');
  div.className = 'bookmark-item';
  div.dataset.id = bookmark.id;
  
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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

function showContextMenu(e, bookmark) {
  e.preventDefault();
  e.stopPropagation();
  selectedBookmark = bookmark;
  
  const menu = elements.contextMenu;
  menu.classList.add('visible');
  
  const x = Math.min(e.pageX, window.innerWidth - menu.offsetWidth - 10);
  const y = Math.min(e.pageY, window.innerHeight - menu.offsetHeight - 10);
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

function hideContextMenu() {
  elements.contextMenu.classList.remove('visible');
}

async function handleSearch(e) {
  const query = e.target.value;
  const bookmarks = query ? 
    await db.searchBookmarks(query) :
    await db.getAllBookmarks();
  renderBookmarks(bookmarks);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => toast.classList.add('visible'), 10);
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showAddBookmarkModal() {
  resetBookmarkForm();
  document.getElementById('modal-title').textContent = 'Add Bookmark';
  
  const saveBtn = document.getElementById('modal-save');
  saveBtn.innerHTML = '<span class="material-icons">save</span>';
  
  elements.mainContent.classList.add('ios-blur');
  elements.navBar.classList.add('ios-blur');
  
  elements.modalOverlay.style.display = 'block';
  elements.bookmarkModal.style.display = 'flex';
  
  void elements.modalOverlay.offsetWidth;
  void elements.bookmarkModal.offsetWidth;
  
  elements.modalOverlay.classList.add('visible');
  elements.bookmarkModal.classList.add('visible');
  
  elements.body.style.overflow = 'hidden';
  
  setTimeout(() => {
    elements.bookmarkForm.elements['bookmark-url'].focus();
  }, 300); 
}

function hideBookmarkModal() {
  elements.bookmarkModal.classList.remove('visible');
  elements.modalOverlay.classList.remove('visible');
  
  elements.mainContent.classList.remove('ios-blur');
  elements.navBar.classList.remove('ios-blur');
  
  elements.bookmarkModal.style.transform = '';
  elements.modalOverlay.style.opacity = '';
  
  setTimeout(() => {
    elements.modalOverlay.style.display = 'none';
    elements.bookmarkModal.style.display = 'none';
    
    elements.body.style.overflow = '';
  }, 300); 
}

function resetBookmarkForm() {
  elements.bookmarkForm.reset();
}

function editBookmark(bookmark) {
  selectedBookmark = bookmark;
  
  const form = elements.bookmarkForm;
  form.elements['bookmark-url'].value = bookmark.url;
  form.elements['bookmark-title'].value = bookmark.title;
  form.elements['bookmark-tags'].value = bookmark.tags ? bookmark.tags.join(', ') : '';
  
  document.getElementById('modal-title').textContent = 'Edit Bookmark';
  
  const saveBtn = document.getElementById('modal-save');
  saveBtn.innerHTML = '<span class="material-icons">update</span>';
  
  elements.mainContent.classList.add('ios-blur');
  elements.navBar.classList.add('ios-blur');
  
  elements.modalOverlay.style.display = 'block';
  elements.bookmarkModal.style.display = 'flex';
  
  void elements.modalOverlay.offsetWidth;
  void elements.bookmarkModal.offsetWidth;
  
  elements.modalOverlay.classList.add('visible');
  elements.bookmarkModal.classList.add('visible');
  
  elements.body.style.overflow = 'hidden';
  
  setTimeout(() => {
    elements.bookmarkForm.elements['bookmark-title'].focus();
  }, 300); 
}

async function deleteBookmark(id) {
  try {
    await db.deleteBookmark(id);
    showToast('Bookmark deleted successfully');
    currentTag = null; 
    loadBookmarks();
  } catch (error) {
    showToast('Error deleting bookmark');
  }
}

async function handleBookmarkSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  try {
    const tagsString = formData.get('bookmark-tags');
    const tags = tagsString
      ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
      : [];
    
    const bookmarkData = {
      url: formData.get('bookmark-url'),
      title: formData.get('bookmark-title'),
      tags
    };
    
    try {
      new URL(bookmarkData.url);
    } catch (urlError) {
      showToast('Please enter a valid URL (include http:// or https://)');
      return;
    }
    
    if (selectedBookmark) {
      await db.updateBookmark(selectedBookmark.id, bookmarkData);
      showToast('Bookmark updated successfully');
      selectedBookmark = null;
    } else {
      await db.addBookmark(bookmarkData);
      showToast('Bookmark added successfully');
    }
    
    loadBookmarks(); 
    hideBookmarkModal();
  } catch (error) {
    showToast('Error saving bookmark');
  }
}

document.addEventListener('click', (e) => {
  if (!elements.contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

function getTagsWithCounts(bookmarks) {
  const tagCount = new Map();
  tagCount.set('All', bookmarks.length); 
  
  bookmarks.forEach(bookmark => {
    if (bookmark.tags) {
      bookmark.tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    }
  });
  
  return tagCount;
}

async function updateTagsView(bookmarks) {
  const tagsContainer = document.getElementById('tags-container');
  const tagsEmptyState = document.getElementById('tags-empty-state');
  
  const tagCount = getTagsWithCounts(bookmarks);
  
  if (tagCount.size <= 1) { 
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
  
  document.querySelectorAll('.tag-item').forEach(tagItem => {
    tagItem.addEventListener('click', () => {
      const tag = tagItem.dataset.tag;
      
      if (currentTag === tag || tag === 'All') {
        currentTag = null;
      } else {
        currentTag = tag;
      }
      
      if (elements.segmentAll) {
        elements.segmentAll.click();
      }
      
      loadBookmarks();
    });
  });
  
  updateFooterCount(); 
}

function updateFooterCount() {
  let count = 0;
  
  const activeView = document.querySelector('.view-container.active');
  
  if (activeView.id === 'all-view') {
    count = activeView.querySelectorAll('.bookmark-item').length;
    elements.footerCount.textContent = `${count} bookmark${count !== 1 ? 's' : ''}`;
  } else if (activeView.id === 'tags-view') {
    count = activeView.querySelectorAll('.tag-item').length;
    count = Math.max(0, count - 1); 
    elements.footerCount.textContent = `${count} tag${count !== 1 ? 's' : ''}`;
  }
}

document.addEventListener('DOMContentLoaded', initApp);

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


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
      const basePath = window.location.pathname.includes('simple-bookmarker') 
          ? '/simple-bookmarker'
          : '';
      
      navigator.serviceWorker.register(`${basePath}/sw.js`, {
          scope: `${basePath}/`
      })
          .then(registration => {
              console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(err => {
              console.error('ServiceWorker registration failed: ', err);
          });
  });
}