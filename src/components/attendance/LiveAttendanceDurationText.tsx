import React, {memo, useEffect, useState} from 'react';
import {Text, type TextProps, type TextStyle} from 'react-native';
import type {AttendanceRecord} from '@app/types/models';
import {formatAttendanceDuration, getOpenSessionElapsedSeconds} from '@app/utils/attendanceReport';

interface Props extends TextProps {
  baseSeconds: number;
  records: AttendanceRecord[];
  style?: TextStyle;
}

/**
 * Updates only this text every second while checked in — avoids re-rendering the full attendance list.
 */
const LiveAttendanceDurationText: React.FC<Props> = ({baseSeconds, records, style, ...textProps}) => {
  const [elapsed, setElapsed] = useState(() => getOpenSessionElapsedSeconds(records));

  useEffect(() => {
    const sync = () => setElapsed(getOpenSessionElapsedSeconds(records));
    sync();
    if (getOpenSessionElapsedSeconds(records) <= 0) {
      return;
    }

    const timer = setInterval(sync, 5000);
    return () => clearInterval(timer);
  }, [records]);

  return (
    <Text {...textProps} style={style}>
      {formatAttendanceDuration(baseSeconds + elapsed)}
    </Text>
  );
};

export default memo(LiveAttendanceDurationText);
