import { handleLogin } from "../auth/login";
import { isEmail } from "../utils/validate";
import { sanitizeInput } from "../utils/validate";

export class LoginForm {
  private email = "";
  private password = "";

  validate(): boolean {
    return isEmail(this.email) && sanitizeInput(this.password).length >= 8;
  }

  onSubmit(): { success: boolean; sessionId?: string } {
    if (!this.validate()) {
      return { success: false };
    }
    return handleLogin(this.email, this.password);
  }
}
