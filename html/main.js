/**
 * Main javascript engine
 */
const host = 'predb.ovh';
const apiEndpoint = '/api/v1';
const apiUrl = 'https://' + host + apiEndpoint;
const wsUrl = 'wss://' + host + apiEndpoint + '/ws';

var $input = document.getElementsByClassName('input-query')[0];
var $btnGo = document.getElementsByClassName('input-go')[0];
var $btnLive = document.getElementsByClassName('input-live')[0];
var $status = document.getElementsByClassName('status')[0];
var $t = document.getElementsByClassName('table')[0];
var $pgn = document.getElementsByClassName('pagination')[0];
var $tpl = document.getElementById('template');
var $tplRow = $tpl.getElementsByClassName('row')[0];

var ws = null;
const empty = '\u00A0';
const validQueryParams = [
    'page',
    'offset',
    'count',
    'q',
    'live',
];

/**
 * Document handlers
 */
window.onpopstate = function (e) {
    setUrl(e.state, true);
    runUrl();
}

/**
 * Query input handlers
 */
function rereadInput() {
    $btnGo.href = $input.value ? '/?q=' + $input.value : '/';
}

$input.onkeyup = function (e) {
    rereadInput();
    if (e.keyCode != 13) {
        return;
    }

    $btnGo.onclick();
}

/**
 * Buttons handlers
 */
function clickHandler(e) {
    if (e.target instanceof HTMLAnchorElement) {
        setUrl(e.target.href);
        runUrl();
        return false;
    }
}

$btnGo.onclick = function () {
    setUrl($btnGo.href);
    runUrl();
    $input.focus();
    return false;
}

$btnLive.onclick = clickHandler;
$pgn.onclick = clickHandler;
$t.onclick = clickHandler;

/**
 * Fetch handlers
 */
function checkHTTP(res) {
    if (res.status == 200) {
        return res;
    } else {
        var err = new Error(res.statusText);
        err.response = res;
        throw err;
    }
}

function parseJSON(res) {
    return res.json();
}

function checkStatus(j) {
    if (j.status == "success") {
        return j.data;
    } else {
        var err = new Error(j.message);
        err.response = j;
        throw err;
    }
}

/**
 * Main query function
 */
function query(str, page) {
    if (ws) {
        ws.close();
        ws = null;
    }

    var req = '';
    var title = '';
    if (str) {
        req = '/?q=' + encodeURIComponent(str)
        title = 'Search ' + str;
    }
    if (page) {
        req += (str ? '&' : '/?') + 'page=' + page;
    }

    setTitle(title);
    hidePageBar();
    status('Loading');
    getAndFill(req).then(paginate);
}

function getAndFill(req) {
    var perfStart = window.performance.now();
    $t.innerHTML = '';
    return fetch(apiUrl + (req || '/'))
        .then(checkHTTP)
        .then(parseJSON)
        .then(checkStatus)
        .then(function (j) {
            $t.innerHTML = '';
            if (j.rowCount === 0) {
                status('No results');
                return;
            }
            var nTime = Math.round(window.performance.now() - perfStart) / 1000;
            status('Results ' + (j.offset + 1) + '-' +
                (j.offset + j.rowCount) + ' of ' + j.total +
                ' matches in ' + nTime + ' seconds');

            var fragment = document.createDocumentFragment();
            j.rows.forEach(function (e) {
                fragment.appendChild(newRow(e));
            }, this);

            $t.appendChild(fragment);

            return j;
        }).catch(function (err) {
            status(err.message || 'Internal error');
        });
}

/**
 * Live websocket engine
 */
function websocket() {
    setTitle('Live');
    hidePageBar();
    status('Live');
    getAndFill('/live');
    if (ws) {
        ws.close()
    }

    $input.value = '';
    rereadInput();

    ws = new WebSocket(wsUrl);
    ws.onopen = function (e) {
        status('Websocket started');
    };
    ws.onmessage = function (e) {
        var j = JSON.parse(e.data);
        if (!j.action) {
            return;
        }

        status('Last update : ' + new Date().toLocaleString());
        switch (j.action) {
            case 'insert':
                $r = newRow(j.row);
                $t.insertBefore($r, $t.firstChild);
                break;
            case 'update':
                var $r = document.getElementById(j.row.id);
                if ($r) {
                    setRow($r, j.row);
                }
                break;
            case 'delete':
                var $r = document.getElementById(j.row.id);
                if ($r) {
                    $r.remove();
                }
                break;
            case 'nuke':
            case 'modnuke':
            case 'unnuke':
            case 'delpre':
            case 'undelpre':
                if (j.row.nuke) {
                    var $r = document.getElementById(j.row.id);
                    if ($r) {
                        setNuke($r, j.row.nuke);
                    }
                }
                break;
        }

    };
    ws.onerror = function (e) {
        status('Websocket error, trying again');
        setTimeout(websocket, 1000);
    };
    ws.onclose = function (e) {
        status('Websocket closed');
    }
}

/**
 * DOM modifiers
 */
function status(str) {
    replaceChildren($status, nodeTxt(str || empty));
}

function newRow(e) {
    var $r = $tplRow.cloneNode(true);
    return setRow($r, e);
}

function setRow($r, e) {
    $r.setAttribute('id', e.id);
    replaceChildren($r.getElementsByClassName('cell-cat')[0], nodeLink('/?q=@cat ' + e.cat, e.cat));
    replaceChildren($r.getElementsByClassName('cell-genre')[0], nodeTxt(e.genre || empty, 30));
    e.dTeam = '-' + e.team;
    e.dName = e.name.replace(e.dTeam, '');
    //replaceChildren($r.getElementsByClassName('rls-name')[0], nodeLink('/?q=@name ' + e.name, e.dName));
    replaceChildren($r.getElementsByClassName('rls-name')[0], nodeTxt(e.dName));
    replaceChildren($r.getElementsByClassName('rls-grp')[0], nodeLink('/?q=@team ' + e.team, e.dTeam));
    if (e.nuke) {
        setNuke($r, e.nuke);
    }
    replaceChildren($r.getElementsByClassName('cell-pretime')[0], nodeTime(e.preAt));
    replaceChildren($r.getElementsByClassName('cell-files')[0], nodeNumber(e.files));
    replaceChildren($r.getElementsByClassName('cell-size')[0], nodeNumber(e.size));
    return $r;
}

function setNuke($r, e) {
    var classList = $r.getElementsByClassName('cell-nuke')[0].classList;
    classList.remove("hidden");
    switch (e.type) {
        case "nuke":
        case "modnuke":
        case "delpre":
            classList.add("nuketype-nuke");
            break;
        case "unnuke":
        case "undelpre":
            classList.add("nuketype-fine");
    }
    replaceChildren($r.getElementsByClassName('nuke-reason')[0], nodeTxt(e.reason));
    //replaceChildren($r.getElementsByClassName('nuke-time')[0], nodeTime(e.nukeAt));
    replaceChildren($r.getElementsByClassName('nuke-net')[0], nodeTxt(e.net));
}

function nodeLink(u, t) {
    var $n = document.createElement('a');
    $n.setAttribute('href', u);
    $n.text = t;
    return $n;
}

function nodeNumber(n) {
    return n > 0 ? nodeTxt(n) : null;
}

function nodeTxt(t, maxLen) {
    if (maxLen && t.length > maxLen) {
        pos = t.indexOf('_', maxLen);
        if (pos != -1) {
            t = t.substring(0, pos);
        }
    }
    return document.createTextNode(t);
}

function nodeTime(timestamp) {
    var $n = document.createElement('time');
    var d = new Date(timestamp * 1000);
    $n.setAttribute('datetime', d.toISOString());
    $n.textContent = d.toLocaleString();
    return $n;
}

function replaceChildren($parent, $e) {
    while ($parent.lastChild) {
        $parent.removeChild($parent.lastChild);
    }
    if ($e) {
        $parent.appendChild($e);
    }
}

/**
 * Pagination handlers
 */
function paginate(j) {
    if (j.rowCount == j.total) {
        hidePageBar();
        return;
    }

    setPageBar(j.offset / j.reqCount + 1, Math.ceil(j.total / j.reqCount));
}

function hidePageBar() {
    $pgn.style.display = 'none';
}

function setPageBar(curr, max) {
    if (max === 0) {
        hidePageBar();
        return;
    }

    var qParams = parseQueryParams(window.location.search);

    var fragment = document.createDocumentFragment();
    var first = curr - 4;
    var last = curr + 5;
    for (var i = first; i <= last; i++) {
        if (i <= 0) {
            first++;
            last++;
            continue;
        }

        if (i === first && i !== curr) {
            fragment.appendChild(newPageButton(curr - 1, qParams, '<<', true));
        }
        if (i > max || i >= last) {
            if (curr !== max) {
                fragment.appendChild(newPageButton(curr + 1, qParams, '>>', true));
            }
            break;
        }
        if (i === curr) {
            fragment.appendChild(newPageButton(i, qParams, i, false));
        } else {
            fragment.appendChild(newPageButton(i, qParams, i, true));
        }
    }

    replaceChildren($pgn, fragment);
    $pgn.style.display = 'block';
}

function newPageButton(i, qParams, text, active) {
    var $btn;
    if (active) {
        $btn = document.createElement('a');
        $btn.text = text;
        $btn.classList.add('page-btn');
        qParams['page'] = i;
        $btn.href = buildQueryUrl(qParams);
    } else {
        $btn = document.createElement('span');
        $btn.textContent = text;
        $btn.classList.add('page-btn', 'page-btn-inactive');
    }
    return $btn;
}

/**
 * URL functions
 */
function setUrl(u, replace) {
    if (!u) {
        u = window.location.href.replace(window.location.search, '');
    }
    if (replace) {
        window.history.replaceState(u, '', u);
    } else {
        window.history.pushState(u, '', u);
    }
}

function setTitle(title) {
    if (title) {
        document.title = title + ' - PREdb';
    } else {
        document.title = 'PREdb';
    }
}

function parseQueryParams(s) {
    if (s == '') {
        return {};
    }

    var split = s.split('?');
    if (split.length < 2) {
        return;
    }

    qParams = {};
    params = split[1].split('&');
    params.forEach(function (p) {
        var [k, v] = p.split('=');
        qParams[k] = decodeURIComponent(v || '');
    });

    return qParams;
}

function buildQueryUrl(qParams) {
    var urlQuery = [];
    validQueryParams.forEach(function (p) {
        if (p == 'live' && urlQuery.length) {
            return;
        }
        if (qParams[p] !== undefined) {
            urlQuery.push(p + (qParams[p] == '' ? '' : '=' + qParams[p]));
        }
    });

    return urlQuery.length ? ('/?' + urlQuery.join('&')) : '';
}

function runUrl() {
    var qParams = parseQueryParams(window.location.search);

    if (qParams.hasOwnProperty('live')) {
        websocket();
        return;
    }

    $input.value = qParams.q || '';
    rereadInput();
    query(qParams.q, qParams.page);
}

runUrl();
