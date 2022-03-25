import * as React from 'react';
import ConferenceService from '../../helpers/ConferenceService';

class ConferenceMonitor extends React.Component {
  state = {
    liveParticipantCount: 0,
    liveWorkerCount: 0,
    stopMonitoring: false
  }

  componentDidUpdate() {

    if (this.state.stopMonitoring) {
      return;
    }

    const { task } = this.props;

    const conference = task && (task.conference || {});
    const {
      conferenceSid,
      liveParticipantCount,
      liveWorkerCount,
      participants = []
    } = conference;
    const liveParticipants = participants.filter(p => p.status === 'joined');

    if (liveParticipantCount > 2 && this.state.liveParticipantCount <= 2) {
      if (this.shouldUpdateParticipants(participants, liveWorkerCount)) {
        this.handleMoreThanTwoParticipants(conferenceSid, liveParticipants);
      }
    } else if (liveParticipantCount <= 2 && this.state.liveParticipantCount > 2) {
      if (this.shouldUpdateParticipants(participants, liveWorkerCount)) {
        this.handleOnlyTwoParticipants(conferenceSid, liveParticipants);
      }
    }

    if (liveParticipantCount !== this.state.liveParticipantCount) {
      this.setState({ liveParticipantCount });

      if (liveWorkerCount !== this.state.liveWorkerCount) {
        const previousLiveWorkerCount = this.state.liveWorkerCount;
        this.setState({ liveWorkerCount });

        const myParticipant = participants.find(p => p.isMyself);    
        // If it was me that left, then stop monitoring at this point. Covers warm and cold transfers and generally stops Flex UI from tinkering
        // once the agent is done with the call.
        if (previousLiveWorkerCount > 0 && myParticipant.status === 'left') {
          console.debug('dialpad-addon, ConferenceMonitor, componentDidUpdate: My participant left. Time to stop monitoring this task/conference');
          this.setState({ stopMonitoring: true });
        }
      }
    }

  }


  hasUnknownParticipant = (participants = []) => {
    return participants.some(p => p.participantType === 'unknown');
  }

  shouldUpdateParticipants = (participants, liveWorkerCount) => {
    console.debug(
      'dialpad-addon, ConferenceMonitor, shouldUpdateParticipants:',
      liveWorkerCount <= 1 && this.hasUnknownParticipant(participants)
    );
    return liveWorkerCount <= 1 && this.hasUnknownParticipant(participants);
  }

  handleMoreThanTwoParticipants = (conferenceSid, participants) => {
    console.log('More than two conference participants. Setting endConferenceOnExit to false for all participants.');
    this.setEndConferenceOnExit(conferenceSid, participants, false);
  }

  handleOnlyTwoParticipants = (conferenceSid, participants) => {
    console.log('Conference participants dropped to two. Setting endConferenceOnExit to true for all participants.');
    this.setEndConferenceOnExit(conferenceSid, participants, true);
  }

  setEndConferenceOnExit = async (conferenceSid, participants, endConferenceOnExit) => {
    const promises = [];
    participants.forEach(p => {
      console.log(`setting endConferenceOnExit = ${endConferenceOnExit} for callSid: ${p.callSid} status: ${p.status}`);
      if (p.connecting) { return } //skip setting end conference on connecting parties as it will fail
      promises.push(
        ConferenceService.setEndConferenceOnExit(conferenceSid, p.callSid, endConferenceOnExit)
      );
    });

    try {
      await Promise.all(promises);
      console.log(`endConferenceOnExit set to ${endConferenceOnExit} for all participants`);
    } catch (error) {
      console.error(`Error setting endConferenceOnExit to ${endConferenceOnExit} for all participants\r\n`, error);
    }
  }

  render() {
    // This is a Renderless Component, only used for monitoring and taking action on conferences
    return null;
  }
}

export default ConferenceMonitor;
