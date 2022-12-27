import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import isEqual from 'lodash/isEqual';
import { ReactComponent as LoadingIcon } from '../../../assets/svg/preloader.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/svg/errorIcon.svg';
import { ReactComponent as SuccessIcon } from '../../../assets/svg/successIcon.svg';
import { connectionStatus } from '../../../store/user/selectors';
import { CONNECTION_STATUS } from '../../../store/channel/constants';

function ConnectionStatus() {
  const [hideSuccessStatus, setHideSuccessStatus] = useState(false);
  const [successTimeout, setSuccessTimeout] = useState(undefined);
  const connectionState = useSelector(connectionStatus, isEqual) || '';

  const ConnectedSuccess = () => (
    <>
      <SuccessIcon />
      Connected
    </>
  );

  useEffect(() => {
    if (connectionState === CONNECTION_STATUS.CONNECTED) {
      setSuccessTimeout(setTimeout(() => setHideSuccessStatus(true), 1500));
    } else {
      setHideSuccessStatus(false);
      clearTimeout(successTimeout);
    }
  }, [connectionState]);

  return (
    <Container>
      {connectionState && (connectionState === CONNECTION_STATUS.CONNECTING ? (
        <>
          <LoadingIcon className="rotate_cont" />
          Connecting
        </>
      )
        : connectionState === CONNECTION_STATUS.DISCONNECTED ? (
          <>
            <LoadingIcon className="rotate_cont" />
            Disconnected
          </>
        )
          : connectionState === CONNECTION_STATUS.CONNECTING_FAILED ? (
            <>
              <ErrorIcon />
              Failed
            </>
          )
            : (connectionState === CONNECTION_STATUS.CONNECTED && !hideSuccessStatus) ? <ConnectedSuccess /> : '')}
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  align-items: center;
  color: #fff;
  font-weight: 500;
  font-size: 16px;
  
  & > svg {
    margin-right: 6px;
  }
`;

export default ConnectionStatus;
