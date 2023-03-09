/// <reference types="react" />
import PropTypes from 'prop-types';
interface ICreateChannelPopup {
    handleClose: () => void;
    channelType: string;
    uriPrefixOnCreateChannel?: string;
}
declare function CreateChannel({ handleClose, channelType, uriPrefixOnCreateChannel }: ICreateChannelPopup): JSX.Element;
declare namespace CreateChannel {
    var propTypes: {
        isButton: PropTypes.Requireable<boolean>;
    };
    var defaultProps: {
        isButton: boolean;
    };
}
export default CreateChannel;
export declare const URILabel: import("styled-components").StyledComponent<"label", any, {}, never>;
