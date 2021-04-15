import * as React from "react";
import { Logger, LogLevel } from "@pnp/logging";
import { isEqual, find, cloneDeep } from "lodash";

import styles from './CovidForm.module.scss';
import Question from "./molecules/Question";
import { CheckInMode, IAnswer, IQuestion, ICheckIns, CheckIns } from "../covid.model";
import Button from "./atoms/Button";
import TextBox from "./atoms/TextBox";
import DropDown, { IDropDownOption } from "./atoms/DropDown";
import { cs } from "../covid.service";
import Dialog from "./molecules/Dialog";
import { IMicrosoftTeams } from "@microsoft/sp-webpart-base";

export interface ICovidFormProps {
  microsoftTeams: IMicrosoftTeams;
  checkInMode: CheckInMode;
  displayName: string;
  close?: () => void;
  userId?: number;
  checkInForm?: ICheckIns;
  userCanCheckIn?: boolean;
}

export interface ICovidFormState {
  checkInForm: ICheckIns;
  dialogVisible: boolean;
  formVisible: boolean;
}

export class CovidFormState implements ICovidFormState {
  constructor(
    public checkInForm: ICheckIns = new CheckIns(),
    public dialogVisible: boolean = false,
    public formVisible: boolean = true
  ) { }
}

export default class CovidForm extends React.Component<ICovidFormProps, ICovidFormState> {
  private LOG_SOURCE: string = "🔶CovidForm";
  private _questions: IQuestion[] = [];
  private _locationOptions: IDropDownOption[] = [];
  private _userCanCheckIn: boolean = this.props.userCanCheckIn;

  constructor(props: ICovidFormProps) {
    super(props);
    this._questions = cloneDeep(cs.Questions);
    this._locationOptions = cs.Locations.map((l) => { return { key: l.Title, text: l.Title }; });
    const today = new Date();
    const title = `${props.displayName} - ${today.toLocaleDateString()}`;
    this.state = new CovidFormState(this.props.checkInForm || new CheckIns(0, title, today, this.props.userId || null, null, "", this._questions.map<IAnswer>((q) => { return { QuestionId: q.Id, Answer: "" }; }), today));
  }

  public shouldComponentUpdate(nextProps: ICovidFormProps, nextState: ICovidFormState) {
    if ((isEqual(nextState, this.state) && isEqual(nextProps, this.props)))
      return false;
    return true;
  }

  private _onQuestionValueChange = (fieldValue: string, fieldName: string) => {
    try {
      const checkInForm = cloneDeep(this.state.checkInForm);
      const questionId: number = +fieldName.split("-")[1];
      let answer = find(checkInForm.QuestionsValue, { QuestionId: questionId });
      answer.Answer = fieldValue;
      this.setState({ checkInForm: checkInForm });
    } catch (err) {
      Logger.write(`${this.LOG_SOURCE} (_onQuestionValueChange) - ${err}`, LogLevel.Error);
    }
  }

  private _onTextChange = (fieldValue: string, fieldName: string) => {
    try {
      const checkInForm = cloneDeep(this.state.checkInForm);
      checkInForm[fieldName] = fieldValue;
      this.setState({ checkInForm: checkInForm });
    } catch (err) {
      Logger.write(`${this.LOG_SOURCE} (_onTextChange) - ${err}`, LogLevel.Error);
    }
  }

  private _save = async (): Promise<void> => {
    try {
      const checkInForm = cloneDeep(this.state.checkInForm);
      let success: boolean = false;
      if (this.props.checkInMode === CheckInMode.Guest) {
        success = await cs.addCheckIn(checkInForm);
      } else {
        success = await cs.addSelfCheckIn(checkInForm);
      }
      if (success) {
        if (this.props.checkInMode == CheckInMode.Self) {
          this.setState({ dialogVisible: true, formVisible: false });
        } else {
          this.props.close();
        }
      }
    } catch (err) {
      Logger.write(`${this.LOG_SOURCE} (_save) - ${err}`, LogLevel.Error);
    }
  }

  private _cancel = () => {
    try {
      if (this.props.checkInMode == CheckInMode.Self) {
        const checkInForm = new CheckIns();
        this.setState({ checkInForm: checkInForm });
      } else {
        this.props.close();
      }
    } catch (err) {
      Logger.write(`${this.LOG_SOURCE} (_cancel) - ${err}`, LogLevel.Error);
    }
  }
  private _changeVisibility = async (visible: boolean): Promise<void> => {
    await this._updateCanUserCheckIn();
    this.setState({ dialogVisible: visible });
  }

  private async _updateCanUserCheckIn() {
    if (this.props.userId) {
      this._userCanCheckIn = await cs.userCanCheckIn(this.props.userId);
    }
  }

  public render(): React.ReactElement<ICovidFormProps> {
    try {

      let formVisibilityCSS: React.CSSProperties;
      let confirmationVisibilityCSS: React.CSSProperties;
      if (this.props.checkInMode === CheckInMode.Guest) {
        formVisibilityCSS = { "display": "grid" } as React.CSSProperties;
        confirmationVisibilityCSS = { "display": "none" } as React.CSSProperties;
      } else {
        if (this._userCanCheckIn) {
          formVisibilityCSS = { "display": "grid" } as React.CSSProperties;
          confirmationVisibilityCSS = { "display": "none" } as React.CSSProperties;
        } else {
          formVisibilityCSS = { "display": "none" } as React.CSSProperties;
          confirmationVisibilityCSS = { "display": "grid" } as React.CSSProperties;
        }
      }


      return (
        <div data-component={this.LOG_SOURCE} className={styles.covidForm}>

          <h1>Covid-19 Employee Self-Attestation Form</h1>
          <p>As on-site work resumes, all employees must complete a Covid-19 self attestation form each day before they enter
            the building. This requirement applies to all employees, contractors, visitors, or temporary employees.</p>
          <p>In the last 72 hours have you experienced any of the following symptoms that are not attributed to another illness?</p>
          <div className={styles.form} style={formVisibilityCSS}>
            {this.props.checkInMode === CheckInMode.Guest ?
              <div className={styles.formRow}>
                <div className={styles.question}>Guest Name</div>
                <TextBox name="Guest" value={this.state.checkInForm.Guest} onChange={this._onTextChange} />
              </div>
              : null}
            <div className={styles.formRow}>
              <div className={styles.question}>Office</div>
              <DropDown onChange={this._onTextChange} value={this.state.checkInForm.CheckInOffice} options={this._locationOptions} id="CheckInOffice" />
            </div>
            {this._questions?.map((q) => {
              const a = find(this.state.checkInForm.QuestionsValue, { QuestionId: q.Id });
              return (<div className={styles.formRow}><Question question={q} answer={a} onChange={this._onQuestionValueChange} /></div>);
            })}
            <div className={`${styles.formRow} ${styles.buttons}`} >
              <Button className="hoo-button-primary" disabled={false} label="Save" onClick={this._save} />
              <Button className="hoo-button" disabled={false} label="Cancel" onClick={this._cancel} />
            </div>
          </div>
          <div style={confirmationVisibilityCSS}>
            <p>Thank you for submitting your attestation for today. You can only submit one attestation per day.</p>
          </div>
          <Dialog header="Submission Submitted Successfully" content="Your check in was submitted successfully." visible={this.state.dialogVisible} onChange={this._changeVisibility} />
        </div>
      );
    } catch (err) {
      Logger.write(`${this.LOG_SOURCE} (render) - ${err}`, LogLevel.Error);
      return null;
    }
  }
}