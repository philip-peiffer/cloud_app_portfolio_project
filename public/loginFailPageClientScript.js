const homeLocations = ['https://portfolio-peifferp.uw.r.appspot.com/login', 'http://localhost:8080/login']

let buttonEl = document.getElementById('gohome')

// enable going home
buttonEl.addEventListener('click', () => {
    location.href = '/login'
})