// Import necessary scripts for service worker
try {
  if(typeof importScripts !== 'undefined') {
    importScripts(
      '/shared/lib/browser-polyfill.js',
      '/shared/options.js', 
      '/shared/context-menus.js',
      '/shared/lib/apache-mime-types.js',
      '/shared/lib/moment.js',
      '/shared/lib/turndown.js',
      '/shared/lib/turndown-plugin-gfm.js',
      '/shared/lib/Readability.js',
      '/shared/text-replace.js',
      '/shared/from-html.js',
      '/shared/to-md.js',
      '/background/background.js'
    );
  }
} catch (e) {
  console.error('Error importing scripts:', e);
}

// Initialize extension
createMenus();
browser.contextMenus.onClicked.addListener(menuListener);