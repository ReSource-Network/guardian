import * as yup from "yup";
import { log } from "../services/logger";

export const registerSchema = yup
  .object()
  .shape({
    email: yup.string().required().email(),
    userId: yup.string().required(),
    multiSigAddress: yup.string().required(),
    clientAddress: yup.string().required(),
  })
  .required();

export const recoverSchema = yup
  .object()
  .shape({
    validateEmailToken: yup.string().required(),
    email: yup.string().required().email(),
    newClientAddress: yup.string().required(),
  })
  .required();

export const resetSchema = yup
  .object()
  .shape({
    email: yup.string().required().email(),
  })
  .required();

export const removeAndFetchSchema = yup
  .object()
  .shape({
    userId: yup.string().required(),
  })
  .required();

export const updateSchema = yup
  .object()
  .shape({
    userId: yup.string().required(),
    data: yup.object().required(),
  })
  .required();

export const migrateBatchSchema = yup
  .object()
  .shape({
    data: yup.array().required(),
  })
  .required();

export const validate = (schema) => async (req, res, next) => {
  const body = req.body;

  try {
    await schema.validate(body);
    next();
  } catch (e: any) {
    log.debug("Error validating request body schema:");
    log.error(e.message);

    return res
      .status(400)
      .json({ ERROR: true, MESSAGE: "SCHEMA VALIDATION ERROR: " + e.message });
  }
};
