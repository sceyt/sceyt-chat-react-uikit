import React from 'react'
import { render, screen } from '@testing-library/react'
import { UploadProgress } from './index'

const styleOf = () => getComputedStyle(screen.getByTestId('box'))

describe('UploadProgress', () => {
  it('fillColor fills the box; backgroundColor colors only its border', () => {
    render(<UploadProgress data-testid='box' borderColor='' backgroundColor='#ffffff' withBorder fillColor='#e1e1e1' />)

    expect(styleOf().backgroundColor).toBe('rgb(225, 225, 225)')
    expect(styleOf().border).toBe('2px solid #ffffff')
  })

  it('without fillColor the box has no background color of its own', () => {
    render(<UploadProgress data-testid='box' borderColor='' backgroundColor='#ffffff' withBorder />)

    expect(styleOf().backgroundColor).toBe('')
    expect(styleOf().border).toBe('2px solid #ffffff')
  })
})
