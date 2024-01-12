export const genToken = (userId) => {
    return fetch(`https://icf2b3q9dd.execute-api.us-east-2.amazonaws.com/api/token?user=${userId}`)
}