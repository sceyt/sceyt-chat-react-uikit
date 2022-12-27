import React, { useState } from 'react'
interface IProps {
  client: string
}

const ChatApp = ({ client }: IProps) => {
  const [user, setUser] = useState('')

  return (
    <div>
      It's your client{client}{' '}
      <button onClick={() => setUser('New User')}>
        Click and change user name{' '}
      </button>{' '}
      {user}
    </div>
  )
}

export { ChatApp }
