import React from 'react'
// import useIsMounted from '../../hooks/basic/useIsMounted'
import { ReactComponent as DeletedAvatarIcon } from '../../assets/svg/deletedUserAvatar.svg'
import { ReactComponent as DefaultAvatar } from '../../assets/svg/devaultAvatar32.svg'
// import DefaultAvatarSrc from '../../assets/img/defaultAvatar.png'
// import defaultAvatarSrc from ''
import styled from 'styled-components'
import { generateAvatarColor } from '../../UIHelper'
import { colors } from '../../UIHelper/constants'

interface IProps {
  image?: string | null
  name: string
  size?: number
  textSize?: number
  marginAuto?: boolean
  setDefaultAvatar?: boolean
  DeletedIcon?: JSX.Element
}

const Avatar: React.FC<IProps> = ({
  image,
  size,
  name,
  textSize,
  DeletedIcon,
  marginAuto,
  setDefaultAvatar
  // customAvatarColors
}) => {
  // const isMounted = useIsMounted()
  // const [avatarImage, setAvatarImage] = useState<{loaded: boolean, src?: string}>({ loaded: false, src: image });
  // const [imageLoaded, setImageLoaded] = useState(isMessage);
  const isDeletedUserAvatar = !image && !name
  let avatarText = ''
  if (!image && name) {
    const trimedName = name.trim()
    const splittedName = trimedName.split(' ')
    if (splittedName.length > 1 && splittedName[1]) {
      const firstWord = splittedName[0]
      const secondWord = splittedName[1]
      const firstCharOfFirstWord = firstWord.codePointAt(0)
      const firstCharOfSecondWord = secondWord.codePointAt(0)

      // @ts-ignore
      avatarText = `${firstCharOfFirstWord ? String.fromCodePoint(firstCharOfFirstWord) : ''}${
        firstCharOfSecondWord ? String.fromCodePoint(firstCharOfSecondWord) : ''
      }`
    } else {
      const firstCharOfFirstWord = trimedName.codePointAt(0)

      avatarText = firstCharOfFirstWord ? String.fromCodePoint(firstCharOfFirstWord) : ''
    }
  }
  /* useEffect(() => {
    if (!isMessage) {
      const imageSrc = image;
      const img = new Image();
      img.onload = () => {
        if (isMounted.current) {
          setAvatarImage({ loaded: true, src: imageSrc });
        }
      };
      img.onerror = () => {
        setAvatarImage({ loaded: false, src: imageSrc });
      };
      img.src = imageSrc || '';
    }
  }, [image]); */
  // console.log('isDeletedUserAvatar .. ', isDeletedUserAvatar);
  return (
    <Container
      marginAuto={marginAuto}
      size={size}
      isImage={!!(image || setDefaultAvatar)}
      avatarName={name}
      textSize={textSize}
    >
      {isDeletedUserAvatar ? (
        // DeletedIcon || <DeletedAvatarIcon />
        DeletedIcon || <DeletedAvatarWrapper color={colors.deleteUserIconBackground} />
      ) : // : !avatarImage.src && name
      !image ? (
        setDefaultAvatar ? (
          <DefaultAvatarWrapper color={colors.defaultAvatarBackground} />
        ) : (
          <span>{avatarText}</span>
        )
      ) : (
        <AvatarImage
          draggable={false}
          showImage
          // showImage={imageLoaded}
          // src={avatarImage.src!}
          src={image}
          size={size}
          // onLoad={() => setImageLoaded(true)}
          /* onError={(e:any) => {
                e.target.onerror = null; // prevents looping
                setAvatarImage({ loaded: true, src: '' });
              }} */
          alt=''
        />
      )}
    </Container>
  )
}

export default Avatar

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
    white-space: nowrap;
    font-weight: 500;
    font-size: ${(props: ContainerProps) => (props.textSize ? `${props.textSize}px` : '14px')}};
  }
  & > svg {
    height: ${(props) => props.size && `${props.size}px`};
    width: ${(props) => props.size && `${props.size}px`};
  }

`

export const AvatarImage = styled.img<AvatarImageProps>`
  visibility: ${(props: AvatarImageProps) => (props.showImage ? 'visible' : 'hidden')};
  width: ${(props) => `${props.size}px`};
  height: ${(props) => `${props.size}px`};
  object-fit: cover;
`

export const DefaultAvatarWrapper = styled(DefaultAvatar)`
  color: ${(props) => props.color || colors.defaultAvatarBackground};
`

export const DeletedAvatarWrapper = styled(DeletedAvatarIcon)`
  color: ${(props) => props.color || colors.deleteUserIconBackground};
`
