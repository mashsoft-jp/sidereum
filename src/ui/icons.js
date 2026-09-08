  // 操作記号を端末のフォントに依存しない線画で統一する。
  // 読み上げ名はボタン側に残し、絵はイベントの対象にしない。
  function uiIcon(name) {
    const paths = {
      plus: "M2 6h8M6 2v8", minus: "M2 6h8",
      close: "M2.5 2.5l7 7M9.5 2.5l-7 7",
      up: "M2.5 7.5L6 4l3.5 3.5", down: "M2.5 4.5L6 8l3.5-3.5",
      left: "M7.5 2.5L4 6l3.5 3.5", right: "M4.5 2.5L8 6l-3.5 3.5",
      menu: "M2 3h8M2 6h8M2 9h8",
    };
    return '<svg class="uiIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" ' +
      'stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="' + paths[name] + '"/></svg>';
  }
  for (const el of document.querySelectorAll("[data-ui-icon]")) {
    el.innerHTML = uiIcon(el.dataset.uiIcon);
  }
