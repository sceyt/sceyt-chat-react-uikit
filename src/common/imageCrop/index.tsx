import React, { useState, useCallback } from 'react'
import styled from 'styled-components'
import Cropper from 'react-easy-crop'
import { useStateComplex, useColor } from '../../hooks'
import getCroppedImg from './crop-image'
import { colors, THEME_COLOR_NAMES } from '../../UIHelper/constants'
import { Popup, PopupName, Row, CloseIcon, Button, PopupBody, PopupFooter } from '../../UIHelper'
import PopupContainer from '../popups/popupContainer'

interface IProps {
  image: any
  onAccept: (file: File) => void
  handleClosePopup: (cropped?: boolean) => void
  theme?: string
}
const ImageCrop = ({ theme, image, onAccept, handleClosePopup }: IProps) => {
  const [area, setArea] = useState(null)
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)

  const [state, setState] = useStateComplex({
    image: image.url,
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 1
    // aspect: 4 / 3
  })

  const onCropChange = (crop: any) => {
    setState({ crop })
  }

  const onZoomChange = (zoom: any) => {
    setState({ zoom })
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setArea(croppedAreaPixels)
  }, [])

  const returnCroppedImage = useCallback(async () => {
    try {
      const imageFile = await getCroppedImg(state.image, area, 0, image.name)
      onAccept(imageFile)
      handleClosePopup(true)
    } catch (e) {
      console.error(e)
    }
  }, [area])
  return (
    <PopupContainer>
      <Popup theme={theme} backgroundColor={colors.backgroundColor} minWidth='500px' maxWidth='600px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon onClick={handleClosePopup} />
          <Row align='center'>
            <PopupName color={textPrimary}>Crop image</PopupName>
          </Row>
          <div className='crop-container'>
            <CropperWrapper>
              <Cropper
                image={state.image}
                crop={state.crop}
                zoom={state.zoom}
                aspect={state.aspect}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropComplete}
                cropShape='round'
                showGrid={false}
              />
            </CropperWrapper>
            <Controls className='controls' background={accentColor}>
              <input
                type='range'
                value={state.zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby='Zoom'
                onChange={(e) => {
                  onZoomChange(e.target.value)
                }}
                className='zoom-range'
              />
            </Controls>
          </div>
        </PopupBody>
        <PopupFooter backgroundColor={colors.backgroundColor}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={() => handleClosePopup()}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={accentColor}
            color={colors.white}
            borderRadius='8px'
            onClick={returnCroppedImage}
          >
            Save
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ImageCrop

const CropperWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
  margin: 14px 0;
`
const Controls = styled.div<{ background: string }>`
  & > input {
    width: 100%;
    -webkit-appearance: none;
    background-color: rgba(178, 182, 190, 0.4);
    border-radius: 3px;

    &::-webkit-slider-runnable-track {
      height: 6px;
      -webkit-appearance: none;
      color: ${colors.primary};
      margin-top: -1px;
      border-radius: 3px;
    }
    &::-webkit-slider-thumb {
      width: 16px;
      -webkit-appearance: none;
      height: 16px;
      cursor: ew-resize;
      background: ${(props) => props.background};
      border-radius: 50%;
      transform: translate(0, -5px);
    }
  }
`
