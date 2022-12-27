import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'

interface IProps {
  src: string
  width: number
  height: number
  borderRadius?: string
  isLoaded: boolean
  isRepliedMessage?: boolean
}

const ImageThumbnail = ({ src, width, height, borderRadius, isLoaded, isRepliedMessage }: IProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const image = new Image(width, height)
    image.src = `data:image/jpeg;base64,${src}`
    image.onload = () => {
      // setLoaded(true)
      if (canvasRef.current) {
        const canvas = canvasRef.current
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        // @ts-ignore
        ctx.drawImage(image, 0, 0, image.width, image.height)
      }
    }
    image.onerror = (e) => {
      // setLoaded(true);
      console.log('error in load image .. ', e)
    }
  }, [])
  return (
    <React.Fragment>
      {/* {!loaded && <EmptyCont width={`${width}px`} height={`${height}px`} />} */}
      <Canvas
        ref={canvasRef}
        borderRadius={borderRadius}
        absolute={isLoaded}
        width={width}
        height={height}
        isRepliedMessage={isRepliedMessage}
      />
    </React.Fragment>
  )
}

export default ImageThumbnail

const Canvas = styled.canvas<{
  borderRadius?: string
  absolute: boolean
  width: number
  height: number
  isRepliedMessage?: boolean
}>`
  //width: ${(props) => `${props.width}px`};
  //height: ${(props) => `${props.height}px`};
  max-width: 420px;
  max-height: 400px;
  width: ${(props) => props.isRepliedMessage && '40px'};
  height: ${(props) => props.isRepliedMessage && '40px'};
  min-width: ${(props) => !props.isRepliedMessage && '130px'};
  border: 2px solid #dff6eb;
  border-radius: ${(props) => props.borderRadius || '4px'};
  box-sizing: border-box;
  z-index: 1;
`

/*
const EmptyCont = styled.div<{ width?: string; height?: string }>`
  max-width: 420px;
  max-height: 400px;
  width: ${(props) => props.width};
  height: ${(props) => props.height};
`
*/
