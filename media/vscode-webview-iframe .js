(function () {
  let ifrm = document.getElementById('webview-iframe');
  window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent
    switch (message.command) {
      case 'mdn':
        ifrm.src = message.url;
        break
    }
  });
})();
