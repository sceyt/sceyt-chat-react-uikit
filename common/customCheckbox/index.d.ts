/// <reference types="react" />
interface IProps {
    onChange: (e: any) => void;
    state: boolean;
    index: any;
    backgroundColor?: string;
    checkedBackgroundColor?: string;
    tickColor?: string;
    borderRadius?: string;
    size?: string;
}
declare const CustomCheckbox: ({ index, state, onChange, checkedBackgroundColor, backgroundColor, tickColor, borderRadius, size }: IProps) => JSX.Element;
export default CustomCheckbox;
