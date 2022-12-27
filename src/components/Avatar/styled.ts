import styled from 'styled-components'
import { generateAvatarColor } from '../../UIHelper'

interface ContainerProps {
  size?: number
  avatarName: string
  textSize?: number
  isImage?: boolean
  marginAuto?: boolean
}

interface AvatarImageProps {
  showImage: boolean
  size?: number
}

export const Container = styled.div<ContainerProps>`
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    text-transform: uppercase;
    justify-content: center;
    width: ${(props) => (props.size ? `${props.size}px` : '38px')};
    height: ${(props) => (props.size ? `${props.size}px` : '38px')};
    border-radius: 50%;
    color: #fff;
    overflow: hidden;
    margin: ${(props) => (props.marginAuto ? 'auto' : '')};
    ${(props: ContainerProps) => (!props.isImage ? `background-color:${generateAvatarColor(props.avatarName)};` : '')};
  span {
    text-transform: uppercase;
    font-style: normal;
    font-weight: 500;
    font-size: ${(props: ContainerProps) => (props.textSize ? `${props.textSize}px` : '14px')}};
  }

`

export const AvatarImage = styled.img<AvatarImageProps>`
  visibility: ${(props: AvatarImageProps) => (props.showImage ? 'visible' : 'hidden')};
  width: ${(props) => `${props.size}px`};
  height: ${(props) => `${props.size}px`};
`
