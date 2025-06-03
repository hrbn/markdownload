// code taken from here: https://stackoverflow.com/a/5084044/304786
function getHTMLOfSelection() {
  var range;
  if (document.selection && document.selection.createRange) {
      range = document.selection.createRange();
      return range.htmlText;
  } else if (window.getSelection) {
      var selection = window.getSelection();
      if (selection.rangeCount > 0) {
          let content = '';
          for (let i = 0; i < selection.rangeCount; i++) {
              range = selection.getRangeAt(0);
              var clonedSelection = range.cloneContents();
              var div = document.createElement('div');
              div.appendChild(clonedSelection);
              content += div.innerHTML;
          }
          return content;
      } else {
          return '';
      }
  } else {
      return '';
  }
}

function getHTMLOfDocument() {
  // if the document doesn't have a "base" element make one
  // this allows the DOM parser in future steps to fix relative uris
  let baseEl = document.createElement('base');

  // check for a existing base elements
  let baseEls = document.head.getElementsByTagName('base');
  if (baseEls.length > 0) {
      baseEl = baseEls[0];
  }
  // if we don't find one, append this new one.
  else {
      document.head.append(baseEl);
  }

  // if the base element doesn't have a href, use the current location
  if (!baseEl.getAttribute('href')) {
      try {
          baseEl.setAttribute('href', window.location.href);
      } catch (error) {
          // Handle CSP violation when setting base URI is blocked
          // This can happen when the page has a 'base-uri none' CSP directive
          console.warn('Cannot set base URI due to Content Security Policy:', error.message);
          // Continue without setting the base URI - relative URLs will be handled during processing
      }
  }
  
  // remove the hidden content from the page

  removeHiddenNodes(document.body);
  
  // get the content of the page as a string
  return document.documentElement.outerHTML;
}


// code taken from here: https://www.reddit.com/r/javascript/comments/27bcao/anyone_have_a_method_for_finding_all_the_hidden/
function removeHiddenNodes(root) {
  let nodeIterator, node,i = 0;

  nodeIterator = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, function(node) {
    let nodeName = node.nodeName.toLowerCase();
    if (nodeName === "script" || nodeName === "style" || nodeName === "noscript" || nodeName === "math") {
      return NodeFilter.FILTER_REJECT;
    }
    if (node.offsetParent === void 0) {
      return NodeFilter.FILTER_ACCEPT;
    }
    let computedStyle = window.getComputedStyle(node, null);
    if (computedStyle.getPropertyValue("visibility") === "hidden" || computedStyle.getPropertyValue("display") === "none") {
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while ((node = nodeIterator.nextNode()) && ++i) {
    if (node.parentNode instanceof HTMLElement) {
      node.parentNode.removeChild(node);
    }
  }
  return root
}

async function getSelectionAndDom() {
  const selection = getHTMLOfSelection()
  const dom = getHTMLOfDocument()
  // const article_obj = await getArticleFromDom(dom)
  // const article = JSON.stringify(article_obj)
  // console.log('getSelectionAndDom', article_obj, article)
  return { selection, dom/*, article*/ }
}

getSelectionAndDom()