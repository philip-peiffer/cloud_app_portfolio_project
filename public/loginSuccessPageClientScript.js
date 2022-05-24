/* ---------- login_success page actions --------------- */
const homeLocations = ['https://portfolio-peifferp.wl.r.appspot.com/', 'http://localhost:8080/']

// place the user information in the html elements
let firstNameEl = document.getElementById('firstname')
let lastNameEl = document.getElementById('lastname')
let identityEl = document.getElementById('uniqueID')
let tokenEl = document.getElementById('token')
let buttonEl = document.getElementById('gohome')

// extract the user information from the query string
const queryString = window.location.search
const params = new URLSearchParams(queryString)
firstNameEl.innerHTML = params.get('first')
lastNameEl.innerHTML = params.get('last')
identityEl.innerHTML = params.get('id')
tokenEl.innerHTML = params.get('token')

// enable going home
buttonEl.addEventListener('click', () => {
    location.href = homeLocations[1]
})