import { useState } from 'react'

const useStateComplex = (initialState: any) => {
  const [state, setState] = useState(initialState)

  return [
    state,
    (value: any) => {
      setState((prevState: any) => ({
        ...prevState,
        ...value
      }))
    }
  ]
}

export default useStateComplex
