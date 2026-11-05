/* Progressive enhancement: the complete map and its links also work without JS. */
(function () {
  'use strict';
  function init() {
    var map = document.getElementById('knowledge-map');
    if (!map || map.classList.contains('km-enhanced')) return;
    var input = document.getElementById('knowledge-search');
    var status = document.getElementById('knowledge-map-status');
    if (!input) return;
    function normalize(value) {
      return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    }
    function searchable(element) {
      return normalize(element.getAttribute('data-search') || element.textContent);
    }
    var branches = Array.from(map.querySelectorAll('.km-branch')).map(function (branch) {
      var summary = branch.querySelector('summary');
      var own = normalize((branch.getAttribute('data-module') || '') + ' ' +
        (branch.getAttribute('data-search') || (summary ? summary.textContent : '')));
      return { element: branch, text: own,
        groups: Array.from(branch.querySelectorAll('.km-group')).map(function (group) {
          var heading = group.querySelector('h4'), description = group.querySelector('p');
          var ownGroup = normalize(group.getAttribute('data-search') ||
            (heading ? heading.textContent : '') + ' ' + (description ? description.textContent : ''));
          return { element: group, text: own + ' ' + ownGroup,
            leaves: Array.from(group.querySelectorAll('.km-leaf')).map(function (leaf) {
              return { element: leaf, text: own + ' ' + ownGroup + ' ' + searchable(leaf), own: searchable(leaf) };
            }) };
        }) };
    });
    var initialStatus = status ? status.textContent : '';
    var beforeSearch = null, currentQuery = '', visibleBranches = branches.length, visibleLeaves = 0;
    var allLeaves = branches.reduce(function (total, branch) {
      return total + branch.groups.reduce(function (count, group) { return count + group.leaves.length; }, 0);
    }, 0);
    function matches(text, terms) { return terms.every(function (term) { return text.indexOf(term) !== -1; }); }
    function report(action) {
      if (!status) return;
      var message = currentQuery ? (visibleLeaves ? '找到 ' + visibleLeaves + ' 个专题节点，分布在 ' + visibleBranches + ' 个模块。' : '没有找到相关知识点，请换一个关键词或清空搜索。') :
        (initialStatus || branches.length + ' 个模块 · ' + allLeaves + ' 个专题节点。展开模块后，点击专题进入题目。');
      status.textContent = message + (action ? ' ' + action : '');
    }
    function filter() {
      var query = normalize(input.value), terms = query ? query.split(' ') : [];
      if (query && !currentQuery) beforeSearch = branches.map(function (branch) { return branch.element.open; });
      var restore = !query && !!currentQuery;
      currentQuery = query; visibleBranches = 0; visibleLeaves = 0;
      branches.forEach(function (branch, branchIndex) {
        var branchMatch = !!query && matches(branch.text, terms), branchLeaves = 0;
        branch.groups.forEach(function (group) {
          var groupMatch = !!query && matches(group.text, terms), groupLeaves = 0;
          group.leaves.forEach(function (leaf) {
            var visible = !query || branchMatch || groupMatch || matches(leaf.text, terms);
            leaf.element.hidden = !visible;
            leaf.element.classList.toggle('km-match', !!query && visible && matches(leaf.own, terms));
            if (visible) groupLeaves++;
          });
          group.element.hidden = !groupLeaves;
          group.element.classList.toggle('km-match', groupMatch && !branchMatch);
          branchLeaves += groupLeaves;
        });
        branch.element.hidden = !branchLeaves;
        branch.element.classList.toggle('km-match', branchMatch);
        if (query) branch.element.open = branchLeaves > 0;
        else if (restore && beforeSearch) branch.element.open = beforeSearch[branchIndex];
        if (branchLeaves) visibleBranches++;
        visibleLeaves += branchLeaves;
      });
      if (restore) beforeSearch = null;
      map.classList.toggle('km-searching', !!query);
      map.classList.toggle('km-empty', !visibleLeaves);
      report();
    }
    input.addEventListener('input', filter);
    input.addEventListener('search', filter);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value) { event.preventDefault(); input.value = ''; filter(); }
    });
    Array.from(map.querySelectorAll('[data-map-action]')).forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var action = button.getAttribute('data-map-action');
        if (action === 'expand' || action === 'collapse') {
          branches.forEach(function (branch) { if (!branch.element.hidden) branch.element.open = action === 'expand'; });
          report(visibleBranches ? (action === 'expand' ? '已展开当前可见模块。' : '已收起当前可见模块。') : '');
        } else if (action === 'reset') {
          input.value = ''; filter();
          report(); input.focus();
        }
      });
    });
    if (status) status.setAttribute('aria-live', 'polite');
    map.classList.add('km-enhanced');
    filter();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
