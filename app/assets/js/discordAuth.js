const axios = require('axios')
const ipcRenderer = require('electron').ipcRenderer
const ConfigManager = require('./configmanager')
const {DISCORD_OPCODE} = require('./ipcconstants')

/**
 *
 * @param {boolean} retry Whether this func called again after token refresh. If true, do not handle auth errors
 * @returns {boolean} Whether the user is logged in to Discord and is a part of specified server
 * */
async function checkDiscordAuth(retry = false) {
    ConfigManager.bootstrapDiscordConfig()

    const user = ConfigManager.getDiscordAuthUser()

    if (!user.nickname) return {result: false, error: 'Auth error'}

    const {accessToken} = user

    try {
        // check if access token has not expired
        await axios({
            method: 'get',
            url: 'https://discord.com/api/v10/users/@me',
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        //get user servers list
        const {data: guilds} = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        for (const guild of guilds) {
            if (guild.id.toString() === ConfigManager.getDiscordServerToValidate().toString()) {
                return {result: true}
            }
        }

        return {result: false, error: 'Not a member of server'}
    } catch (error) {
        if (error.response && error.response.status === 401 && !retry) {
            await refreshDiscrodToken()
            return checkDiscordAuth(true)
        }

        console.error(error)

        return {result: false, error: 'Auth error'}
    }
}

async function refreshDiscrodToken() {
    const refreshToken = ConfigManager.getDiscordAuthUser().refreshToken

    if (!refreshToken) {
        return {result: false, error: 'Refresh token not found'}
    }

    const {data} = await axios.post('https://discord.com/api/oauth2/token',
        new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: ConfigManager.getDiscordAuthUser().refreshToken,
            client_id: '1558891129070686309',
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })

    const {data: user} = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: `Bearer ${data.access_token}`
        }
    })

    ConfigManager.setDiscordAuthUser({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        nickname: user.username
    })

    ConfigManager.save()

    return {result: true}
}

exports.checkDiscordAuth = checkDiscordAuth
exports.refreshDiscordToken = refreshDiscrodToken

exports.discordAuth = function () {
    return new Promise((resolve, reject) => {
        ipcRenderer.send(DISCORD_OPCODE.OPEN_LOGIN)

        ipcRenderer.on(DISCORD_OPCODE.REPLY_LOGIN, async (_, code, verifier) => {
            try {
                const {data} = await axios({
                    method: 'post',
                    url: 'https://discord.com/api/oauth2/token',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    data: new URLSearchParams({
                        client_id: '1558891129070686309',
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: 'http://example.com',
                        code_verifier: verifier
                    }).toString()
                })

                const {data: user} = await axios.get('https://discord.com/api/v10/users/@me', {
                    headers: {
                        Authorization: `Bearer ${data.access_token}`
                    }
                })

                ConfigManager.setDiscordAuthUser({
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    nickname: user.username,
                    avatar: user.avatar,
                    id: user.id
                })

                ConfigManager.save()

                resolve({result: true})
            } catch (error) {
                reject(error)
            }
        })
    })
}