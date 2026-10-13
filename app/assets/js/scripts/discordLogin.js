const discordLoginButton = document.querySelector('#discordLogin')
discordLoginButton.addEventListener('click', () => {
    DiscordAuth.discordAuth().then(r => {
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
        } else {
            $('#loginDiscordError').text(r.error).show()
        }
    })
})