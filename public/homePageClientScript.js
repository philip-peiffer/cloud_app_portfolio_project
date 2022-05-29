/* ---------- home page actions --------------- */
function handleClick(event){
    location.href = window.location.href + '/googlelogin'
}

let button = document.getElementById('authorize')
button.addEventListener('click', handleClick)