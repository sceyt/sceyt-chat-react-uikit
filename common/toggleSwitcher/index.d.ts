/// <reference types="react" />
interface IProps {
    handleSwitch?: () => void;
    state: boolean;
    backgroundColor?: string;
}
declare const ToggleSwitch: ({ state, handleSwitch, backgroundColor }: IProps) => JSX.Element;
export default ToggleSwitch;
