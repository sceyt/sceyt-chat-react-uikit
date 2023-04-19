/**
 * Default CSS definition for typescript,
 * will be overridden with file-specific definitions by rollup
 */
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}

declare module '*.png' {
  const value: any
  export = value
}

// @ts-ignore
// type SvgrComponent = React.StatelessComponent<React.SVGAttributes<SVGElement>>

// declare module '*.svg' {
//   const svgUrl: string
// const svgComponent: SvgrComponent
// export default svgUrl
// export { svgComponent as ReactComponent }
