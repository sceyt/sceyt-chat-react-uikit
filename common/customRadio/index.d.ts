/// <reference types="react" />
interface IProps {
    onChange: (e: any) => void;
    state: boolean;
    index: any;
    checkedBorder?: string;
    border?: string;
    tickColor?: string;
    borderRadius?: string;
    size?: string;
    disabled?: boolean;
}
declare const CustomRadio: ({ index, state, onChange, checkedBorder, border, borderRadius, size, disabled }: IProps) => JSX.Element;
export default CustomRadio;
