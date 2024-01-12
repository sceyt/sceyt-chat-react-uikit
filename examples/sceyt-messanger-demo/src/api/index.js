export const genToken = (userId) => {
    return fetch(`https://tlnig20qy7.execute-api.us-east-2.amazonaws.com/dev/user/genToken?user=${userId}`)
}
