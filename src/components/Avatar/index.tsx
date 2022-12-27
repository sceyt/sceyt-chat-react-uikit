import React from 'react'
// import useIsMounted from '../../hooks/basic/useIsMounted'
// import { ReactComponent as DeletedAvatarIcon } from '../../assets/lib/svg/deletedUserAvatar.svg'
import { ReactComponent as DefaultAvatar } from '../../assets/svg/devaultAvatar32.svg'
// import DefaultAvatarSrc from '../../assets/img/defaultAvatar.png'
// import defaultAvatarSrc from ''
import { AvatarImage, Container } from './styled'

interface IProps {
  image?: string | null
  name: string
  size?: number
  textSize?: number
  marginAuto?: boolean
  setDefaultAvatar?: boolean
  DeletedIcon?: JSX.Element
  defaultAvatarIcon?: JSX.Element
}

const Avatar: React.FC<IProps> = ({
  image,
  size,
  name,
  textSize,
  DeletedIcon,
  marginAuto,
  setDefaultAvatar,
  defaultAvatarIcon
  // customAvatarColors
}) => {
  // const isMounted = useIsMounted()
  // const [avatarImage, setAvatarImage] = useState<{loaded: boolean, src?: string}>({ loaded: false, src: image });
  // const [imageLoaded, setImageLoaded] = useState(isMessage);
  const isDeletedUserAvatar = !image && !name
  let avatarText = ''

  if (!image && name) {
    const splittedName = name.split(' ')
    if (splittedName.length > 1 && splittedName[1]) {
      avatarText = `${splittedName[0][0]}${splittedName[1][0]}`
    } else {
      avatarText = `${splittedName[0][0]}${splittedName[0][1] || ''}`
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
        DeletedIcon || <DefaultAvatar />
      ) : // : !avatarImage.src && name
      !image ? (
        setDefaultAvatar ? (
          defaultAvatarIcon || <DefaultAvatar />
        ) : (
          <span>{avatarText}</span>
        )
      ) : (
        <AvatarImage
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
