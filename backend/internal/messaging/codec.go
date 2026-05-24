package messaging

import (
	"encoding/binary"
	"encoding/json"
	"io"
	"sync"
)

var writeMu sync.Mutex

func ReadMessage(r io.Reader) (*Envelope, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, err
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, err
	}

	var msg Envelope
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}

	return &msg, nil
}

func WriteMessageSafe(w io.Writer, msg *Envelope) error {
	writeMu.Lock()
	defer writeMu.Unlock()
	return WriteMessage(w, msg)
}

func WriteMessage(w io.Writer, msg *Envelope) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	length := uint32(len(data))
	if err := binary.Write(w, binary.LittleEndian, length); err != nil {
		return err
	}

	_, err = w.Write(data)
	return err
}

func NewMessage(msgType string, id string, payload any) *Envelope {
	return &Envelope{
		Version: 1,
		Type:    msgType,
		ID:      id,
		Payload: payload,
	}
}

func NewError(id string, errMsg string) *Envelope {
	return &Envelope{
		Version: 1,
		Type:    MsgTypeJobError,
		ID:      id,
		Error:   errMsg,
	}
}
