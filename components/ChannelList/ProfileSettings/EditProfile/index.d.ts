/// <reference types="react" />
import { IUser } from '../../../../types';
interface IProps {
    user: IUser;
    handleCloseEditProfile: () => void;
}
declare const EditProfile: ({ handleCloseEditProfile, user }: IProps) => JSX.Element;
export default EditProfile;
