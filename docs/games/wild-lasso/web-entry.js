'use strict';
if (new URLSearchParams(window.location.search).get('desktop') === '1') {
  document.body.classList.add('desktop');
}
