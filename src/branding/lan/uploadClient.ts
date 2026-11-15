/**
 * Runs in the phone browser. Resizes a camera-roll photo before the TV sees it.
 * No absolute URLs: the page is forbidden from naming an off-TV host.
 */
export const uploadClientScript = `
(function () {
  var form = document.querySelector('form');
  var note = document.getElementById('note');
  var title = document.getElementById('title');
  var intro = document.getElementById('intro');
  if (!form || !note) return;
  var button = form.querySelector('button');
  var MAX_EDGE = 1600;
  var SMALL_BYTES = 1500000;
  var LIMIT = 10485760;

  form.addEventListener('submit', function (event) {
    var input = form.querySelector('input[type=file]');
    var file = input && input.files && input.files[0];
    if (!file) return;
    event.preventDefault();
    if (button && button.disabled) return;
    if (button) button.disabled = true;
    setNote('', 'Preparing the photo…');
    var fields = new FormData(form);
    prepare(file).then(function (ready) {
      if (!ready) {
        if (button) button.disabled = false;
        setNote('err', 'That photo is too large. Choose a smaller JPEG or PNG.');
        return;
      }
      fields.set('logo', ready, ready.name || 'logo.jpg');
      setNote('', 'Sending to the TV…');
      return fetch(form.getAttribute('action'), {
        method: 'POST',
        body: fields,
        credentials: 'same-origin',
        cache: 'no-store'
      }).then(function (response) {
        return response.text().then(function (html) {
          if (response.ok && html.indexOf('The TV has the logo') !== -1) {
            showSuccess();
            return;
          }
          if (button) button.disabled = false;
          setNote('err', messageFrom(html) || 'The TV did not take that photo. Try again.');
        });
      });
    }).catch(function () {
      if (button) button.disabled = false;
      setNote('err', 'The photo could not be sent. Stay on this Wi-Fi and try again.');
    });
  });

  function showSuccess() {
    if (title) title.textContent = 'Logo saved';
    if (intro) intro.hidden = true;
    form.hidden = true;
    setNote('ok', 'The TV has the logo. You can close this page.');
  }

  function setNote(kind, text) {
    note.className = kind;
    note.textContent = text;
  }

  function messageFrom(html) {
    var match = /<p[^>]*>([^<]+)/.exec(html);
    if (!match) return '';
    return match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }

  function prepare(file) {
    return decode(file).then(function (image) {
      if (!image) return underLimit(file) ? file : null;
      var edge = Math.max(image.width, image.height);
      var type = String(file.type || '').toLowerCase();
      var small = edge > 0 && edge <= MAX_EDGE && file.size > 0 && file.size <= SMALL_BYTES && (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png');
      if (small) {
        image.close();
        return file;
      }
      return renderJpeg(image).then(function (blob) {
        image.close();
        if (blob && blob.size > 0 && blob.size <= LIMIT) return blob;
        return underLimit(file) ? file : null;
      });
    });
  }

  function underLimit(file) {
    return !!(file && file.size > 0 && file.size <= LIMIT);
  }

  function decode(file) {
    if (typeof createImageBitmap !== 'function') return viaImage(file);
    return createImageBitmap(file).then(function (bmp) {
      var edge = Math.max(bmp.width, bmp.height);
      if (edge <= 4096) return wrap(bmp, bmp.width, bmp.height);
      var longEdge = edge || 1;
      var rw = bmp.width >= bmp.height ? MAX_EDGE : Math.max(1, Math.round(bmp.width * MAX_EDGE / longEdge));
      var rh = bmp.height > bmp.width ? MAX_EDGE : Math.max(1, Math.round(bmp.height * MAX_EDGE / longEdge));
      if (typeof bmp.close === 'function') bmp.close();
      return createImageBitmap(file, { resizeWidth: rw, resizeHeight: rh, resizeQuality: 'high' }).then(function (small) {
        return wrap(small, small.width, small.height);
      });
    }).catch(function () {
      return viaImage(file);
    });
  }

  function viaImage(file) {
    return new Promise(function (resolve) {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        resolve(null);
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(wrap(img, img.naturalWidth || img.width, img.naturalHeight || img.height));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  function wrap(source, width, height) {
    return {
      source: source,
      width: width,
      height: height,
      close: function () {
        if (source && typeof source.close === 'function') source.close();
      }
    };
  }

  function renderJpeg(image) {
    var edge = Math.max(image.width, image.height, 1);
    var scale = Math.min(1, MAX_EDGE / edge);
    var dw = Math.max(1, Math.round(image.width * scale));
    var dh = Math.max(1, Math.round(image.height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    var ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dw, dh);
    try {
      ctx.drawImage(image.source, 0, 0, dw, dh);
    } catch (error) {
      return Promise.resolve(null);
    }
    return blobAt(canvas, 0.82).then(function (blob) {
      if (!blob) return blobAt(canvas, 0.72);
      if (blob.size > LIMIT) return blobAt(canvas, 0.55);
      return blob;
    });
  }

  function blobAt(canvas, quality) {
    return new Promise(function (resolve) {
      if (typeof canvas.toBlob !== 'function') {
        resolve(null);
        return;
      }
      canvas.toBlob(function (blob) {
        resolve(blob && blob.size ? blob : null);
      }, 'image/jpeg', quality);
    });
  }
})();
`.trim();
