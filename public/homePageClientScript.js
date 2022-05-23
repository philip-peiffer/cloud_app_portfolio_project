const oauthLocations = ['https://portfolio-peifferp.wl.r.appspot.com/login', 'http://localhost:8080/login']

const locationIndex = 1

/* ---------- home page actions --------------- */
function handleClick(event){
    console.log("clicked")
    location.href = oauthLocations[locationIndex]
}

let button = document.getElementById('authorize')
button.addEventListener('click', handleClick)