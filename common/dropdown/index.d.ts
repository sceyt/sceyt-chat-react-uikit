/// <reference types="react" />
interface IProps {
    trigger: JSX.Element;
    position?: string;
    withIcon?: boolean;
    iconColor?: string;
    isStatic?: boolean;
    forceClose?: boolean;
    isSelect?: boolean;
    dropDownState?: boolean;
    order?: number;
    watchToggleState?: (state: boolean) => void;
    height?: string;
    children?: JSX.Element | JSX.Element[];
}
declare const DropDown: ({ trigger, position, withIcon, iconColor, isStatic, forceClose, isSelect, dropDownState, watchToggleState, height, children, order }: IProps) => JSX.Element;
export default DropDown;
