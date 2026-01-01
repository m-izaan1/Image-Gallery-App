/* === Image Gallery - fullscreen & visibility fixes (drop-in replacement) ===
   Overwrites previous Image Gallery.js. Keeps your global names (menu, sidebar, folderBtn, folderInput, gallery, etc.).
*/

const menu = document.getElementById("menu-el");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("overlay");
const popup = document.getElementById("SelectedImage");

const folderBtn = document.getElementById('folder-size');
const folderInput = document.getElementById('folderInput');
const gallery = document.getElementById('gallery');

const STORAGE_KEY = 'mg_images_v1';

// Theme System
let currentTheme = localStorage.getItem('gallery_theme') || 'dark';

// Pagination System
let currentPage = 1;
let itemsPerPage = 12;
let allImages = [];

// Theme Functions
function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeToggle();
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('gallery_theme', currentTheme);
  updateThemeToggle();
  
  // Add smooth transition effect
  document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  setTimeout(() => {
    document.body.style.transition = '';
  }, 300);
  
  showNotification(`Switched to ${currentTheme} theme`, 'success');
}

function updateThemeToggle() {
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');
  
  if (themeIcon && themeText) {
    if (currentTheme === 'dark') {
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Dark';
    } else {
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Light';
    }
  }
}

if (folderInput) {
  if ('webkitdirectory' in document.createElement('input')) {
    folderInput.setAttribute('webkitdirectory', '');
    folderInput.setAttribute('directory', '');
    folderInput.setAttribute('mozdirectory', '');
  } else {
    folderInput.removeAttribute('webkitdirectory');
    folderInput.setAttribute('multiple', '');
  }

  const wrapperBtn = document.querySelector('.folder-button');
  function openFolderPicker() { try { folderInput.click(); } catch (e) { console.warn('Folder picker open failed', e); } }
  if (folderBtn) folderBtn.addEventListener('click', openFolderPicker);
  if (wrapperBtn) wrapperBtn.addEventListener('click', openFolderPicker);

  folderInput.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (files.length === 0) { 
      showNotification('No files chosen.', 'error');
      return; 
    }

    const imageFiles = files.filter(file => {
      const t = (file.type || '').toLowerCase();
      return t.startsWith('image/') || /\.(jpe?g|png|svg|webp)$/i.test(file.name);
    });

    if (imageFiles.length === 0) { 
      showNotification('No image files found in the selection.', 'error');
      folderInput.value = ''; 
      return; 
    }

    try {
      showNotification('Processing images...', 'success');
      
      // Enhanced file processing with date and folder information
      const dataArray = await Promise.all(imageFiles.map(f => {
        // Extract folder name from webkitRelativePath if available
        let folderName = 'Untitled Album';
        if (f.webkitRelativePath) {
          const pathParts = f.webkitRelativePath.split('/');
          folderName = pathParts[0] || 'Untitled Album';
        }
        
        return fileToDataURL(f).then(d => ({ 
          src: d, 
          name: f.name, 
          caption: f.name,
          dateAdded: new Date().toISOString(),
          lastModified: new Date(f.lastModified).toISOString(),
          size: f.size,
          folderName: folderName,
          path: f.webkitRelativePath || f.name
        }));
      }));
      
      // Sort images by date (newest first)
      dataArray.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      
      // Load existing images from storage
      let existingImages = [];
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          existingImages = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Could not load existing images', e);
      }
      
      // Merge new images with existing ones
      const mergedImages = [...existingImages, ...dataArray];
      
      try { 
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mergedImages)); 
      }
      catch (e) { 
        console.warn('Could not save to sessionStorage (size?)', e);
        showNotification('Warning: Images too large for storage', 'error');
      }

      allImages = mergedImages;
      currentPage = 1; // Reset to first page
      displayPaginatedGallery();
      
      // Get folder name for notification
      const folderName = dataArray[0]?.folderName || 'Untitled Album';
      showNotification(`Added ${imageFiles.length} images from '${folderName}'. Total: ${mergedImages.length} images`, 'success');
    } catch (err) {
      console.error('Error reading files:', err);
      showNotification('Failed to read files. Please try again.', 'error');
    } finally {
      folderInput.value = '';
    }
  });
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function populateGalleryFromDataArray(dataArray) {
  allImages = dataArray;
  displayPaginatedGallery();
}

function displayPaginatedGallery() {
  const grid = document.querySelector('.mg-gallery-grid');
  const galleryElement = document.getElementById('gallery');
  
  if (!grid && !galleryElement) return;
  
  // Create mg-gallery-grid if it doesn't exist
  let targetGrid = grid;
  if (!targetGrid && galleryElement) {
    targetGrid = document.createElement('div');
    targetGrid.className = 'mg-gallery-grid';
    galleryElement.appendChild(targetGrid);
  }
  
  targetGrid.innerHTML = '';
  
  // Sort by date (newest first) if dates are available
  const sortedData = allImages.sort((a, b) => {
    if (a.dateAdded && b.dateAdded) {
      return new Date(b.dateAdded) - new Date(a.dateAdded);
    }
    return 0;
  });
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);
  
  // Create gallery items with staggered animation
  paginatedData.forEach((it, index) => {
    const figure = document.createElement('figure');
    figure.className = 'mg-item';
    figure.style.animationDelay = `${index * 0.1}s`;
    
    const img = document.createElement('img');
    img.src = it.src;
    img.alt = it.name || '';
    img.loading = 'lazy';
    
    const cap = document.createElement('figcaption');
    cap.textContent = it.caption || '';
    cap.style.color = 'var(--text-muted)';
    cap.style.fontSize = 'var(--font-size-sm)';
    cap.style.padding = 'var(--spacing-xs)';
    
    figure.appendChild(img);
    figure.appendChild(cap);
    targetGrid.appendChild(figure);
  });
  
  // Update pagination controls
  updatePaginationControls(totalPages);
  
  // Reinitialize gallery
  initMgallery();
}

function updatePaginationControls(totalPages) {
  const paginationElement = document.getElementById('galleryPagination');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const paginationInfo = document.getElementById('paginationInfo');
  
  if (!paginationElement) return;
  
  // Show pagination only if there are multiple pages
  if (totalPages > 1) {
    paginationElement.style.display = 'flex';
    
    // Update buttons
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // Update info
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  } else {
    paginationElement.style.display = 'none';
  }
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    displayPaginatedGallery();
    scrollToGallery();
  }
}

function nextPage() {
  const totalPages = Math.ceil(allImages.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    displayPaginatedGallery();
    scrollToGallery();
  }
}

function scrollToGallery() {
  const gallery = document.getElementById('gallery');
  if (gallery) {
    gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();
    
    // Initialize auth state
    initAuth();
    
    // Initialize slider if on home page
    if (document.querySelector('.image-slider')) {
        initSlider();
    }
    
    // Initialize empty states and album/pictures loading
    initPageContent();
    
    // Only load images on Pictures.html, not on home page
    const isPicturesPage = window.location.pathname.includes('Pictures.html');
    const isHomePage = window.location.pathname.includes('Image Gallery.html') || window.location.pathname === '/';
    
    // Try to load images from sessionStorage only on Pictures page
    const storedImages = sessionStorage.getItem('mg_images_v1');
    if (storedImages && isPicturesPage) {
        try {
            const imageArray = JSON.parse(storedImages);
            if (imageArray && imageArray.length > 0) {
                allImages = imageArray;
                displayPaginatedGallery();
                // Hide empty states and show content
                hideEmptyStates();
            }
        } catch (e) {
            console.error('Error loading stored images:', e);
        }
    }
    
    // Initialize the gallery regardless of whether there are stored images
    initMgallery();
});

/* ---------- core gallery init with robust fullscreen handling ---------- */
let __mg_state = null;

function ensureSpinnerExists(lb) {
  if (!lb) return null;
  let spinner = lb.querySelector('.mg-lb-spinner');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.className = 'mg-lb-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.innerHTML = '<div class="mg-lb-spinner-circle" aria-hidden="true"></div>';
    const stage = lb.querySelector('.mg-lb-stage');
    if (stage) stage.appendChild(spinner);
    else lb.appendChild(spinner);
  }
  return spinner;
}
function showSpinner(s){ if(s) s.style.display='flex'; }
function hideSpinner(s){ if(s) s.style.display='none'; }

function initMgallery() {
  // cleanup
  if (__mg_state) {
    try {
      const s = __mg_state;
      if (s.items) {
        s.items.forEach((it, idx) => {
          it.removeEventListener('click', s.itemClickFns[idx]);
          it.removeEventListener('keydown', s.itemKeyFns[idx]);
        });
      }
      if (s.closeBtn && s.closeFn) s.closeBtn.removeEventListener('click', s.closeFn);
      if (s.prevBtn && s.prevFn) s.prevBtn.removeEventListener('click', s.prevFn);
      if (s.nextBtn && s.nextFn) s.nextBtn.removeEventListener('click', s.nextFn);
      if (s.documentKeydown) document.removeEventListener('keydown', s.documentKeydown);
      if (s.lbClick) s.lb.removeEventListener('click', s.lbClick);
      if (s.stage && s.stageTouchStart) s.stage.removeEventListener('touchstart', s.stageTouchStart);
      if (s.stage && s.stageTouchEnd) s.stage.removeEventListener('touchend', s.stageTouchEnd);
      if (s.lbImg && s.dragPrevent) s.lbImg.removeEventListener('dragstart', s.dragPrevent);
      if (s.fullscreenChange) document.removeEventListener('fullscreenchange', s.fullscreenChange);
    } catch (e) {}
    __mg_state = null;
  }

  const gallerySelector = '.mg-gallery-grid';
  const itemSelector = '.mg-item';
  const lb = document.querySelector('.mg-lightbox');
  const lbImg = lb?.querySelector('.mg-lb-image');
  const lbCaption = lb?.querySelector('.mg-lb-caption');
  const closeBtn = lb?.querySelector('.mg-lb-close');
  const prevBtn = lb?.querySelector('.mg-lb-prev');
  const nextBtn = lb?.querySelector('.mg-lb-next');
  const stage = lb?.querySelector('.mg-lb-stage');

  if (!document.querySelector(gallerySelector) || !lb || !lbImg) return;

  const spinner = ensureSpinnerExists(lb);
  hideSpinner(spinner);

  const items = Array.from(document.querySelectorAll(`${gallerySelector} ${itemSelector}`));
  const images = items.map(it => {
    const img = it.querySelector('img');
    return { el: it, imgEl: img, src: img?.getAttribute('src'), alt: img?.getAttribute('alt') || '', caption: (it.querySelector('figcaption')?.textContent || '') };
  }).filter(x => x.src);

  let currentIndex = -1;
  let animTimeout = null;
  let lastTouchX = null;

  function preload(i) { if (i<0||i>=images.length) return; const p=new Image(); p.src=images[i].src; }

  function tmpLoadImage(index, direction) {
    return new Promise((resolve) => {
      const data = images[index];
      if (!data) { resolve(false); return; }

      showSpinner(spinner);
      lbImg.classList.remove('mg-visible');
      lbImg.className = 'mg-lb-image';
      if (direction==='left') lbImg.classList.add('mg-enter-from-left');
      if (direction==='right') lbImg.classList.add('mg-enter-from-right');

      const tmp = new Image();
      tmp.onload = () => {
        lbImg.src = tmp.src;
        lbImg.alt = data.alt || '';
        lbCaption.textContent = data.caption || '';
        // Force a small reflow then reveal. This helps when fullscreen modifies layout.
        requestAnimationFrame(() => {
          // ensure we give browser a tick to apply fullscreen if it's happening
          setTimeout(() => {
            hideSpinner(spinner);
            // ensure image will scale correctly (see CSS changes below)
            // remove/add visible class to force repaint where necessary
            lbImg.classList.remove('mg-visible');
            // force reflow:
            // eslint-disable-next-line no-unused-expressions
            lbImg.offsetWidth;
            lbImg.classList.add('mg-visible');
            preload(index-1);
            preload(index+1);
            resolve(true);
          }, 60);
        });
      };
      tmp.onerror = () => {
        hideSpinner(spinner);
        lbImg.src = '';
        lbCaption.textContent = data.caption || '';
        resolve(false);
      };
      tmp.src = data.src;
    });
  }

  async function openLightbox(index) {
    if (index<0 || index>=images.length) return;
    currentIndex = index;
    document.documentElement.classList.add('mg-lb-open');
    lb.setAttribute('aria-hidden','false');

    await tmpLoadImage(index, null);

    // Request fullscreen on the *lightbox container* (lb) for better consistency.
    try {
      const fsTarget = lb; // use lb to include overlay & controls
      if (fsTarget && fsTarget.requestFullscreen && !document.fullscreenElement) {
        await fsTarget.requestFullscreen().catch(()=>{});
      }
    } catch(e){}

    // After fullscreenchange fires, the handler will ensure caption visibility and repaint
    stage?.focus();
  }

  async function transitionTo(newIndex, dir) {
    if (newIndex === currentIndex) return;
    lbImg.classList.remove('mg-visible');
    clearTimeout(animTimeout);
    animTimeout = setTimeout(async () => {
      await tmpLoadImage(newIndex, dir);
      currentIndex = newIndex;
    }, 100);
  }

  function showNext(){ if (currentIndex<0) return; const nxt=(currentIndex+1)%images.length; transitionTo(nxt,'right'); }
  function showPrev(){ if (currentIndex<0) return; const prev=(currentIndex-1+images.length)%images.length; transitionTo(prev,'left'); }

  function closeLightbox() {
    lb.setAttribute('aria-hidden','true');
    document.documentElement.classList.remove('mg-lb-open');
    lbImg.className='mg-lb-image';
    lbImg.src='';
    if (lbCaption) lbCaption.textContent='';
    currentIndex=-1;
    hideSpinner(spinner);
    try { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); } catch(e){}
  }

  const itemClickFns = [], itemKeyFns = [];
  items.forEach((it, idx) => {
    const onClick = (e) => { e.preventDefault(); openLightbox(idx); };
    const onKey = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openLightbox(idx); } };
    it.addEventListener('click', onClick);
    it.setAttribute('tabindex','0');
    it.addEventListener('keydown', onKey);
    itemClickFns.push(onClick); itemKeyFns.push(onKey);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', showPrev);
  if (nextBtn) nextBtn.addEventListener('click', showNext);

  const documentKeydown = (e) => {
    if (lb.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  };
  document.addEventListener('keydown', documentKeydown);

  const lbClick = (e) => { if (e.target === lb || e.target === stage) closeLightbox(); };
  lb.addEventListener('click', lbClick);

  const stageTouchStart = (e) => { lastTouchX = e.touches[0].clientX; };
  const stageTouchEnd = (e) => {
    if (lastTouchX == null) return;
    const dx = (e.changedTouches[0].clientX - lastTouchX);
    if (Math.abs(dx) > 35) { if (dx < 0) showNext(); else showPrev(); }
    lastTouchX = null;
  };
  if (stage) { stage.addEventListener('touchstart', stageTouchStart, {passive:true}); stage.addEventListener('touchend', stageTouchEnd); }

  const dragPrevent = (e) => e.preventDefault();
  lbImg.addEventListener('dragstart', dragPrevent);

  // fullscreenchange handler: hide caption and force repaint on enter; restore on exit
  const fullscreenChange = () => {
    const fsEl = document.fullscreenElement;
    // if lb is fullscreen (or stage inside lb), hide caption and force image repaint
    if (fsEl && lb && (fsEl === lb || lb.contains(fsEl))) {
      if (lbCaption) {
        lbCaption.style.display = 'none';
      }
      // force repaint of image so it scales properly in fullscreen
      lbImg.classList.remove('mg-visible');
      // force reflow then show
      // eslint-disable-next-line no-unused-expressions
      lbImg.offsetWidth;
      lbImg.classList.add('mg-visible');
    } else {
      // exited fullscreen -> show caption again
      if (lbCaption) {
        lbCaption.style.display = '';
      }
      // also ensure image visible
      lbImg.classList.add('mg-visible');
    }
  };
  document.addEventListener('fullscreenchange', fullscreenChange);

  __mg_state = {
    lb, lbImg, lbCaption, closeBtn, prevBtn, nextBtn, stage,
    items, itemClickFns, itemKeyFns,
    closeFn: closeLightbox, prevFn: showPrev, nextFn: showNext,
    documentKeydown, lbClick, stageTouchStart, stageTouchEnd, dragPrevent, fullscreenChange
  };
}

/* sidebar helpers (unchanged) */
/* Sidebar show/hide helpers (replace any existing versions) */

// Show sidebar and overlay; keep names exactly the same as your other code expects
function showsidebar() {
  try {
    if (!sidebar) return;
    // mark sidebar visible
    sidebar.style.display = 'flex';
    // ensure CSS class for animation
    sidebar.classList.add('open');

    // show overlay
    const ov = document.getElementById('overlay');
    if (ov) {
      ov.classList.add('visible');
      ov.setAttribute('aria-hidden', 'false');
      // Add click listener to overlay to dismiss sidebar
      ov.onclick = Closesidebar;
    }

    // prevent body scrolling while sidebar open
    document.documentElement.classList.add('no-scroll'); // optional
    document.body.classList.add('sidebar-open');

    // move focus into sidebar for accessibility
    const firstFocus = sidebar.querySelector('a, button, [tabindex]');
    if (firstFocus) firstFocus.focus();
  } catch (e) {
    console.warn('showsidebar error', e);
  }
}

function Closesidebar() {
  try {
    if (!sidebar) return;
    // hide sidebar
    sidebar.classList.remove('open');
    // give CSS a moment for animation then hide
    setTimeout(() => { sidebar.style.display = 'none'; }, 220);

    // hide overlay and remove click listener
    const ov = document.getElementById('overlay');
    if (ov) {
      ov.classList.remove('visible');
      ov.setAttribute('aria-hidden', 'true');
      ov.onclick = null;
    }

    // restore scrolling
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('sidebar-open');

    // return focus to menu button
    const menuBtn = document.getElementById('menu-el');
    if (menuBtn) menuBtn.focus();
  } catch (e) {
    console.warn('Closesidebar error', e);
  }
}

function closeSidebar() {
    Closesidebar();
}

// Authentication System
let currentUser = null;

function initAuth() {
    // Check if user is logged in
    const storedUser = localStorage.getItem('gallery_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        updateAuthUI();
    }
}

function showAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmit');
    const confirmPassword = document.getElementById('authConfirmPassword');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitchLink');
    
    if (mode === 'login') {
        title.textContent = 'Login';
        submitBtn.textContent = 'Login';
        confirmPassword.style.display = 'none';
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Sign up';
        switchLink.setAttribute('data-mode', 'signup');
    } else {
        title.textContent = 'Sign Up';
        submitBtn.textContent = 'Sign Up';
        confirmPassword.style.display = 'block';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Login';
        switchLink.setAttribute('data-mode', 'login');
    }
    
    modal.style.display = 'flex';
    overlay.style.display = 'block';
    overlay.classList.add('visible');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
    overlay.style.display = 'none';
    overlay.classList.remove('visible');
}

function switchAuthMode() {
    const link = document.getElementById('authSwitchLink');
    const mode = link.getAttribute('data-mode');
    showAuthModal(mode);
}

function loginWithGoogle() {
    // Simulate Google login
    currentUser = {
        name: 'Google User',
        email: 'user@gmail.com',
        avatar: 'https://via.placeholder.com/40',
        loginMethod: 'google'
    };
    
    localStorage.setItem('gallery_user', JSON.stringify(currentUser));
    updateAuthUI();
    closeAuthModal();
    showNotification('Successfully logged in with Google!', 'success');
}

function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    
    if (currentUser) {
        authSection.innerHTML = `
            <div class="user-info">
                <img src="${currentUser.avatar}" alt="User Avatar" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;">
                <span>Welcome, ${currentUser.name}!</span>
                <button class="auth-btn" onclick="logout()" style="margin-left: 10px;">Logout</button>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <button class="theme-toggle" onclick="toggleTheme()" title="Toggle Theme">
                <span id="themeIcon">🌙</span>
                <span id="themeText">Dark</span>
            </button>
            <button class="auth-btn" onclick="showAuthModal('login')">Login</button>
            <button class="auth-btn" onclick="showAuthModal('signup')">Sign Up</button>
        `;
        updateThemeToggle(); // Update theme toggle when logged out
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('gallery_user');
    updateAuthUI();
    showNotification('Successfully logged out!', 'success');
}

// Handle auth form submission
document.addEventListener('DOMContentLoaded', function() {
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const confirmPassword = document.getElementById('authConfirmPassword').value;
            const submitBtn = document.getElementById('authSubmit');
            
            if (submitBtn.textContent === 'Sign Up' && password !== confirmPassword) {
                showNotification('Passwords do not match!', 'error');
                return;
            }
            
            // Simulate successful auth
            currentUser = {
                name: email.split('@')[0],
                email: email,
                avatar: 'https://via.placeholder.com/40',
                loginMethod: 'email'
            };
            
            localStorage.setItem('gallery_user', JSON.stringify(currentUser));
            updateAuthUI();
            closeAuthModal();
            
            const action = submitBtn.textContent === 'Login' ? 'logged in' : 'signed up';
            showNotification(`Successfully ${action}!`, 'success');
            
            // Clear form
            authForm.reset();
        });
    }
});

// Slider functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');

function initSlider() {
    if (slides.length > 0) {
        showSlide(0);
        // Auto-advance slides every 5 seconds
        setInterval(() => {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }, 5000);
    }
}

function showSlide(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    if (slides[index]) slides[index].classList.add('active');
    if (dots[index]) dots[index].classList.add('active');
    
    currentSlide = index;
}

function changeSlide(direction) {
    currentSlide += direction;
    if (currentSlide >= slides.length) currentSlide = 0;
    if (currentSlide < 0) currentSlide = slides.length - 1;
    showSlide(currentSlide);
}

function currentSlideIndex(index) {
    showSlide(index - 1);
}

// Download functionality
function downloadApp(platform) {
    const downloadUrls = {
        windows: '#windows-download',
        mac: '#mac-download',
        android: '#android-download',
        ios: '#ios-download'
    };
    
    showNotification(`Starting download for ${platform}...`, 'success');
    
    // In a real app, you would trigger the actual download here
    console.log(`Download started for ${platform}`);
}

// Notification System
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger show animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Display Albums functionality
function displayAlbums() {
    const albumsGrid = document.getElementById('albumsGrid');
    const emptyState = document.querySelector('.empty-state');
    
    if (!albumsGrid) return;
    
    // Load images from storage
    let storedImages = [];
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            storedImages = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Could not load images for albums', e);
    }
    
    if (storedImages.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        albumsGrid.style.display = 'none';
        return;
    }
    
    // Group images by folder name
    const albums = {};
    storedImages.forEach(img => {
        const folderName = img.folderName || 'Untitled Album';
        if (!albums[folderName]) {
            albums[folderName] = {
                name: folderName,
                images: [],
                coverImage: null,
                dateAdded: img.dateAdded,
                imageCount: 0
            };
        }
        albums[folderName].images.push(img);
        albums[folderName].imageCount++;
        if (!albums[folderName].coverImage) {
            albums[folderName].coverImage = img.src;
        }
    });
    
    // Hide empty state and show albums grid
    if (emptyState) emptyState.style.display = 'none';
    albumsGrid.style.display = 'grid';
    
    // Clear existing albums
    albumsGrid.innerHTML = '';
    
    // Create album cards
    Object.values(albums).forEach(album => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        
        const dateFormatted = album.dateAdded 
            ? new Date(album.dateAdded).toLocaleDateString()
            : 'Unknown date';
        
        albumCard.innerHTML = `
            <div class="album-cover">
                <img src="${album.coverImage}" alt="${album.name}" loading="lazy">
            </div>
            <div class="album-info">
                <h3 class="album-name">${album.name}</h3>
                <p class="album-count">${album.imageCount} ${album.imageCount === 1 ? 'image' : 'images'}</p>
            </div>
        `;
        
        // Add click handler to view album (navigate to Pictures page)
        albumCard.addEventListener('click', () => {
            // Store the selected album in sessionStorage for filtering
            sessionStorage.setItem('selectedAlbum', album.name);
            window.location.href = 'Pictures.html';
        });
        
        albumsGrid.appendChild(albumCard);
    });
}

// Initialize page content and empty states
function initPageContent() {
    // Check if we're on the Albums page
    const albumsGrid = document.getElementById('albumsGrid');
    if (albumsGrid) {
        displayAlbums();
    }
}

function hideEmptyStates() {
    // Hide any empty state messages when content is loaded
    const emptyStates = document.querySelectorAll('.empty-state');
    emptyStates.forEach(state => state.style.display = 'none');
    
    // Show the gallery wrapper when images are present
    const galleryWrapper = document.querySelector('.mg-gallery-wrapper');
    if (galleryWrapper && allImages.length > 0) {
        galleryWrapper.style.display = 'block';
        console.log(`Gallery shown with ${allImages.length} images, pagination should ${allImages.length > itemsPerPage ? 'activate' : 'not activate'}`);
    }
}
