const discordLoginButton = document.querySelector('#discordLogin')
console.log('loginButton', discordLoginButton)
discordLoginButton.addEventListener('click', () => {
    console.log('clicked')
    DiscordAuth.discordAuth().then(r => {
        console.log(r)
        if (r.result) {
            const isLoggedIn = Object.keys(ConfigManager.getAuthAccounts()).length > 0
            if(isLoggedIn){
                switchView(getCurrentView(), VIEWS.landing)
            } else {
                loginOptionsCancelEnabled(false)
                loginOptionsViewOnLoginSuccess = VIEWS.landing
                loginOptionsViewOnLoginCancel = VIEWS.loginOptions
                switchView(getCurrentView(), VIEWS.loginOptions)
            }
        }
    })
})