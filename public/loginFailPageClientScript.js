const homeLocations = ['https://portfolio-peifferp.wl.r.appspot.com/', 'http://localhost:8080/']

let buttonEl = document.getElementById('gohome')

// enable going home
buttonEl.addEventListener('click', () => {
    location.href = homeLocations[1]
})