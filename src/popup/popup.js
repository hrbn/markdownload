//function to send the download message to the background page
function sendDownloadMessage(text) {
    if (text != null) {

        return browser.tabs.query({
            currentWindow: true,
            active: true
        }).then(tabs => {
            var message = {
                type: "download",
                markdown: text,
                title: document.getElementById("title").value,
                tab: tabs[0],
                imageList: imageList,
                mdClipsFolder: mdClipsFolder
            };
            return browser.runtime.sendMessage(message);
        });
    }
}

//function that handles messages from the injected script into the site
function notify(message) {
    // message for displaying markdown
    if (message.type == "display.md") {

        // set the values from the message
        //document.getElementById("md").value = message.markdown;
        cm.setValue(message.markdown);
        document.getElementById("title").value = message.article.title;
        imageList = message.imageList;
        mdClipsFolder = message.mdClipsFolder;
        
        // show the hidden elements
        document.getElementById("container").style.display = 'flex';
        document.getElementById("spinner").style.display = 'none';
         // focus the download button
        document.getElementById("download").focus();
        cm.refresh();
    }
}

// ----------------------------------------------------------------

const downloadListener = (id, url) => {
  const self = (delta) => {
    if (delta.id === id && delta.state && delta.state.current == "complete") {
      // detatch this listener
      browser.downloads.onChanged.removeListener(self);
      //release the url for the blob
      URL.revokeObjectURL(url);
    }
  }
  return self;
}

// function to turn the title into a valid file name (local version for popup)
function generateValidFileName(title, disallowedChars = null) {
  if (!title) return title;
  else title = title + '';
  // remove < > : " / \ | ? * 
  var illegalRe = /[\/\?<>\\:\*\|":]/g;
  // and non-breaking spaces (thanks @Licat)
  var name = title.replace(illegalRe, "").replace(new RegExp('\u00A0', 'g'), ' ');
  
  if (disallowedChars) {
    for (let c of disallowedChars) {
      if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
      name = name.replace(new RegExp(c, 'g'), '');
    }
  }
  
  return name;
}

const downloadsApi = async (state) => {
  // create the object url with markdown data as a blob
  const url = URL.createObjectURL(new Blob([state.markdown], {
    type: "text/markdown;charset=utf-8"
  }))

  try {
    // start the download
    console.log(state)
    const id = await browser.downloads.download({
      url: url,
      filename: state.mdClipsFolder + generateValidFileName(state.title, state.options.disallowedChars) + ".md",
      saveAs: state.options.saveAs
    })

    // add a listener for the download completion
    browser.downloads.onChanged.addListener(downloadListener(id, url))

    // download images (if enabled)
    if (state.options.downloadImages) {
      // get the relative path of the markdown file (if any) for image path
      const destPath = state.mdClipsFolder + state.title.substring(0, state.title.lastIndexOf('/'));
      if(destPath && !destPath.endsWith('/')) destPath += '/';
      Object.entries(state.imageList).forEach(async ([src, filename]) => {
        // start the download of the image
        const imgId = await browser.downloads.download({
          url: src,
          // set a destination path (relative to md file)
          filename: destPath ? destPath + filename : filename,
          saveAs: false
        })
        // add a listener (so we can release the blob url)
        browser.downloads.onChanged.addListener(downloadListener(imgId, src));
      });
    }

  }
  catch (err) {
    console.error("Download failed", err)
  }
}

const downloadFromContentLink = async (state) => {
  // create the object url with markdown data as a blob
  const url = URL.createObjectURL(new Blob([state.markdown], {
    type: "text/markdown;charset=utf-8"
  }))

  const mdlink = document.createElement('a')
  mdlink.download = state.mdClipsFolder/*.replaceAll('/','_')*/ + state.title/*.replaceAll('/','_')*/ + ".md"
  mdlink.href = url
  mdlink.click()

  // download images (if enabled)
  if (state.options.downloadImages) {
    // get the relative path of the markdown file (if any) for image path
    let destPath = state.mdClipsFolder //+ state.title.substring(0, state.title.lastIndexOf('/'));
    if(destPath && !destPath.endsWith('/')) destPath += '/';
    // TODO: There's still something funny with the way image paths are url encoded
    // destPath = destPath.replaceAll('/','_')
    console.log(destPath)
    Object.entries(state.imageList).forEach(async ([src, filename]) => {
      const imglink = document.createElement('a')
      imglink.download = destPath ? destPath + filename : filename
      imglink.href = src
      imglink.click()
    });
  }
}

const downloadFiles = async (state) => {
  // ensure trailing slash on the download folder
  if(state.mdClipsFolder && !state.mdClipsFolder.endsWith('/')) state.mdClipsFolder += '/'

  // download via the downloads API
  if (state.options.downloadMode == 'downloadsApi' && browser.downloads) downloadsApi(state)
  // otherwise via content links
  else downloadFromContentLink(state)
}

// event handler for download button
async function download(e) {
  e.preventDefault()
  const markdown = state.cm.getValue()
  await downloadFiles({ ...state, markdown, title: document.getElementById("title").value })
  // window.close()
}

// event handler for download selected button
async function downloadSelection(e) {
  e.preventDefault()
  if (state.cm.somethingSelected()) {
    const markdown = state.cm.getSelection()
    await downloadFiles({ ...state, markdown, title: document.getElementById("title").value })
    // window.close()
  }
}

// ----------------------------------------------------------------

// some state variables to hold onto while the popup is open
const state = {
  options: defaultOptions,
  cm: null,
  tab: null,
  dom: null,
  selection: null,
  article: null,
  markdown: null,
  imageList: null,
  mdClipsFolder: null
}

// all the stuff that should happen when the popup is loaded (i.e. the button is clicked)
const init = async () => {
  // listen for notifications from the background page (still necessary??)
  browser.runtime.onMessage.addListener(notify)

  // set up CodeMirror
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  state.cm = CodeMirror.fromTextArea(document.getElementById("md"), {
    theme: darkMode ? "xq-dark" : "xq-light",
    mode: { name: "yaml-frontmatter", base:"gfm" },
    lineWrapping: true
  })
  state.cm.on("cursorActivity", (cm) => {
    const somethingSelected = cm.somethingSelected()
    var a = document.getElementById("downloadSelection")

    if (somethingSelected && a.style.display != "block") a.style.display = "block"
    else if(!somethingSelected && a.style.display != "none") a.style.display = "none"
  })

  // get and check the options
  state.options = await getOptions()
  checkInitialSettings()
  
  // add event listeners for the buttons
  document.getElementById("download").addEventListener("click", download)
  document.getElementById("downloadSelection").addEventListener("click", downloadSelection)
  document.getElementById("selected").addEventListener("click", toggleClipSelection)
  document.getElementById("document").addEventListener("click", toggleClipSelection)
  document.getElementById("includeTemplate").addEventListener("click",toggleIncludeTemplate)
  document.getElementById("downloadImages").addEventListener("click", toggleDownloadImages)

  await clipSite()
}

// the function that does the majority of the heavy lifting
const clipSite = async () => {
  // get the html content of the current tab
  const tabs = await browser.tabs.query({ currentWindow: true, active: true })
  state.tab = tabs[0]
  var id = state.tab.id
  const contentResult = await browser.scripting.executeScript({ 
    target: { tabId: id, allFrames: true },
    files: ["/contentScript/pageContext.js", "/contentScript/getSelectionAndDom.js"]
  })
  console.log(contentResult)

  // make sure we actually get results
  if(!contentResult || contentResult.length === 0 || !contentResult[0]){
    return showError("Unable to get html from content script")
  }

  state.dom = contentResult[0].result.dom
  state.selection = contentResult[0].result.selection

  // if we have a selection, show the slection option
  showOrHideClipOption(state.selection)

  // use Readability to trim down the article and extract metadata
  state.article = await getArticleFromDom(state.dom)
  console.log(state.article)

  // convert the article to markdown
  const { markdown, imageList } = await convertArticleToMarkdown(state.article)
  state.markdown = markdown
  state.imageList = imageList

  // format the title
  state.article.title = await formatTitle(state.article)

  // format the mdClipsFolder
  state.mdClipsFolder = await formatMdClipsFolder(state.article)

  // set the values from the message
  //document.getElementById("md").value = message.markdown;
  state.cm.setValue(state.markdown);
  document.getElementById("title").value = state.article.title
  
  // show the hidden elements
  document.getElementById("container").style.display = 'flex'
  document.getElementById("spinner").style.display = 'none'
  // focus the download button
  document.getElementById("download").focus()
  state.cm.refresh()
  console.log("state", state)
}

// ----------------------------------------------------------------

function showError(err) {
  console.error(err)
  // show the hidden elements
  document.getElementById("container").style.display = 'flex'
  document.getElementById("spinner").style.display = 'none'
  state.cm.setValue(`Error clipping the page\n\n${err}`)
}

// check the checkboxes that need to be checked
const checkInitialSettings = () => {
  if (state.options.includeTemplate)
    document.querySelector("#includeTemplate").classList.add("checked")

  if (state.options.downloadImages)
    document.querySelector("#downloadImages").classList.add("checked")

  if (state.options.clipSelection)
    document.querySelector("#selected").classList.add("checked")
  else
    document.querySelector("#document").classList.add("checked")
}

const toggleClipSelection = (e) => {
  if(e) e.preventDefault()
  state.options.clipSelection = !state.options.clipSelection
  document.querySelector("#selected").classList.toggle("checked")
  document.querySelector("#document").classList.toggle("checked")
  browser.storage.sync.set(state.options).then(() => clipSite()).catch((error) => console.error(error))
}

const toggleIncludeTemplate = (e) => {
  if(e) e.preventDefault()
  state.options.includeTemplate = !state.options.includeTemplate
  document.querySelector("#includeTemplate").classList.toggle("checked")
  browser.storage.sync.set(state.options).then(() => {
    browser.contextMenus.update("toggle-includeTemplate", { checked: state.options.includeTemplate })
    try {
      browser.contextMenus.update("tabtoggle-includeTemplate", { checked: state.options.includeTemplate })
    } catch { }
    return clipSite()
  }).catch((error) => console.error(error))
}

const toggleDownloadImages = (e) => {
  if(e) e.preventDefault()
  state.options.downloadImages = !state.options.downloadImages
  document.querySelector("#downloadImages").classList.toggle("checked")
  browser.storage.sync.set(state.options).then(() => {
    browser.contextMenus.update("toggle-downloadImages", { checked: state.options.downloadImages })
    try {
      browser.contextMenus.update("tabtoggle-downloadImages", { checked: state.options.downloadImages })
    } catch { }
  }).catch((error) => console.error(error))
}

const showOrHideClipOption = selection => {
  if (selection) document.getElementById("clipOption").style.display = "flex"
  else document.getElementById("clipOption").style.display = "none"
}

// --- Now that everything is defined, run the init function --- //
init()
