/// <reference types="react" />
import PropTypes from 'prop-types';
declare function EditProfile({ toggleEditPopup, user }: any): JSX.Element;
declare namespace EditProfile {
    var propTypes: {
        channel: PropTypes.Requireable<PropTypes.InferProps<{
            name: PropTypes.Requireable<string>;
            subject: PropTypes.Requireable<string>;
        }>>;
        toggleEditPopup: PropTypes.Requireable<(...args: any[]) => any>;
        user: PropTypes.Validator<{
            [x: string]: any;
        }>;
    };
    var defaultProps: {
        channel: null;
        toggleEditPopup: null;
    };
}
export default EditProfile;
