var host = 'predb.ovh';
var apiEndpoint = '/api/v1/';
var apiUrl = 'https://' + host + apiEndpoint;

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

function stats() {
    fetch(apiUrl + 'stats')
        .then(checkHTTP)
        .then(parseJSON)
        .then(checkStatus)
        .then(function (j) {
            document.getElementsByClassName('s-last-update')[0].textContent = new Date(j.date).toLocaleString();
            document.getElementsByClassName('s-duration')[0].textContent = Math.round(j.time * 1000) + 'ms';
            document.getElementsByClassName('s-total')[0].textContent = j.total;
        }).catch(function (err) {
            console.log(err);
            document.getElementsByClassName('stats')[0].style.display = 'none';
        });
}

stats();
