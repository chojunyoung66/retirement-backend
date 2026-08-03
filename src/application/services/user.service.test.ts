import type { IUserRepo } from "../contracts/user-repo.contract.js";
import type { IHashUtil } from "../../shared/contracts/hash-util.contract.js";
import { createUserService, WITHDRAWAL_PHRASE } from "./user.service.js";

describe("UserService", () => {
  let userService: ReturnType<typeof createUserService>;
  let mockUserRepo: Partial<IUserRepo>;
  let mockHashUtil: Partial<IHashUtil>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockUserRepo = {
      findById: jest.fn(),
      findAuthById: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
    };

    mockHashUtil = {
      compare: jest.fn(),
      hash: jest.fn(),
    };

    userService = createUserService(
      mockUserRepo as IUserRepo,
      mockHashUtil as IHashUtil,
    );
  });

  describe("getProfile", () => {
    it("해피패스: userId로 사용자 정보를 조회", async () => {
      // given
      const userId = 1;
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "test@example.com",
        password: "hashed",
        name: "테스트유저",
        googleSub: null,
        profileImage: null,
      });

      // when
      const result = await userService.getProfile(userId);

      // then
      expect(mockUserRepo.findAuthById).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        id: userId,
        email: "test@example.com",
        name: "테스트유저",
        hasPassword: true,
      });
      expect(result).not.toHaveProperty("password");
    });

    it("존재하지 않는 userId로 조회 시 USER_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 9999;

      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(userService.getProfile(userId)).rejects.toMatchObject({
        code: "USER_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockUserRepo.findAuthById).toHaveBeenCalledWith(userId);
    });
  });

  describe("updateProfile", () => {
    it("해피패스: 사용자 이름을 업데이트", async () => {
      // given
      const userId = 1;
      const newName = "변경된이름";
      const updatedUser = {
        id: userId,
        email: "test@example.com",
        name: newName,
      };

      (mockUserRepo.update as jest.Mock).mockResolvedValueOnce(updatedUser);
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "test@example.com",
        password: "hashed",
        name: newName,
        googleSub: null,
        profileImage: null,
      });

      // when
      const result = await userService.updateProfile(userId, { name: newName });

      // then
      expect(mockUserRepo.update).toHaveBeenCalledWith(userId, { name: newName });
      expect(result).toEqual({ ...updatedUser, hasPassword: true });
      // 반환 DTO에 password 필드가 없어야 함 (보안)
      expect(result).not.toHaveProperty("password");
      expect(Object.keys(result).sort()).toEqual([
        "email",
        "hasPassword",
        "id",
        "name",
      ]);
    });

    it("해피패스: 현재 비밀번호 확인 후 새 비밀번호를 해시해 업데이트", async () => {
      // given
      const userId = 1;
      const newPassword = "newpassword123";
      const hashedNew = "hashed-new-password";
      const updatedUser = {
        id: userId,
        email: "test@example.com",
        name: "테스트유저",
      };

      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "test@example.com",
        password: "hashed-old",
        name: "테스트유저",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(true);
      (mockHashUtil.hash as jest.Mock).mockResolvedValueOnce(hashedNew);
      (mockUserRepo.update as jest.Mock).mockResolvedValueOnce(updatedUser);

      // when
      const result = await userService.updateProfile(userId, {
        password: newPassword,
        currentPassword: "oldpassword12",
      });

      // then
      expect(mockHashUtil.compare).toHaveBeenCalledWith(
        "oldpassword12",
        "hashed-old",
      );
      expect(mockHashUtil.hash).toHaveBeenCalledWith(newPassword);
      expect(mockUserRepo.update).toHaveBeenCalledWith(userId, {
        password: hashedNew,
      });
      expect(result).toEqual({ ...updatedUser, hasPassword: true });
      expect(result).not.toHaveProperty("password");
    });

    it("현재 비밀번호가 틀리면 INVALID_CREDENTIALS이고 update를 호출하지 않는다", async () => {
      const userId = 1;
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "test@example.com",
        password: "hashed-old",
        name: "테스트유저",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        userService.updateProfile(userId, {
          password: "newpassword123",
          currentPassword: "wrong-password",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });

      expect(mockHashUtil.hash).not.toHaveBeenCalled();
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it("Google-only 계정은 이 API로 비밀번호를 설정할 수 없다", async () => {
      const userId = 2;
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "google@example.com",
        password: null,
        name: "구글유저",
        googleSub: "sub-1",
        profileImage: null,
      });

      await expect(
        userService.updateProfile(userId, {
          password: "newpassword123",
          currentPassword: "anything",
        }),
      ).rejects.toMatchObject({
        code: "PASSWORD_NOT_SET",
        statusCode: 400,
      });

      expect(mockHashUtil.compare).not.toHaveBeenCalled();
      expect(mockHashUtil.hash).not.toHaveBeenCalled();
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it("업데이트할 필드가 없을 때({}) INVALID_UPDATE 예외 발생", async () => {
      // given
      const userId = 1;
      const emptyData = {};

      // when & then
      await expect(
        userService.updateProfile(userId, emptyData),
      ).rejects.toMatchObject({
        code: "INVALID_UPDATE",
        statusCode: 400,
      });

      // repo.update가 호출되지 않아야 함 (사전 검증에서 실패)
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    // TODO(bug): 현재 updateProfile은 `!data.name && !data.password` 로 falsy 검사만 한다.
    //   따라서 name="" (빈 문자열) 처럼 "필드는 제공되었지만 값이 falsy"인 경우도
    //   업데이트 필드가 없는 것으로 간주되어 INVALID_UPDATE가 던져진다.
    //   진짜 의도는 "필드 존재 여부"를 봐야 하므로 향후 수정 필요.
    //   본 테스트는 현재(버그 있는) 동작을 문서화하기 위함이다.
    it("[BUG-DOC] name='' (빈 문자열)을 넘기면 falsy 검사로 인해 INVALID_UPDATE가 발생 (현재 동작)", async () => {
      // given
      const userId = 1;
      const dataWithEmptyName = { name: "" };

      // when & then: 실제로는 name 필드를 제공했지만, 현재 코드는 빈 문자열을 "없음"으로 취급
      await expect(
        userService.updateProfile(userId, dataWithEmptyName),
      ).rejects.toMatchObject({
        code: "INVALID_UPDATE",
        statusCode: 400,
      });

      // 사전 검증 실패로 repo.update는 호출되지 않음
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteAccount", () => {
    it("해피패스: 비밀번호 확인 후 계정을 삭제한다", async () => {
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
        password: "hashed",
        name: "테스트",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(true);
      (mockUserRepo.deleteById as jest.Mock).mockResolvedValueOnce(undefined);

      await userService.deleteAccount(1, { password: "password12" });

      expect(mockHashUtil.compare).toHaveBeenCalledWith("password12", "hashed");
      expect(mockUserRepo.deleteById).toHaveBeenCalledWith(1);
    });

    it("비밀번호가 틀리면 INVALID_CREDENTIALS", async () => {
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
        password: "hashed",
        name: "테스트",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        userService.deleteAccount(1, { password: "wrong" }),
      ).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });
      expect(mockUserRepo.deleteById).not.toHaveBeenCalled();
    });

    it("해피패스: Google-only는 이메일·문구 확인 후 삭제", async () => {
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: 2,
        email: "google@example.com",
        password: null,
        name: "구글유저",
        googleSub: "sub-1",
        profileImage: null,
      });
      (mockUserRepo.deleteById as jest.Mock).mockResolvedValueOnce(undefined);

      await userService.deleteAccount(2, {
        emailConfirm: "google@example.com",
        phrase: WITHDRAWAL_PHRASE,
      });

      expect(mockHashUtil.compare).not.toHaveBeenCalled();
      expect(mockUserRepo.deleteById).toHaveBeenCalledWith(2);
    });

    it("Google-only 확인 정보가 틀리면 INVALID_REQUEST", async () => {
      (mockUserRepo.findAuthById as jest.Mock).mockResolvedValueOnce({
        id: 2,
        email: "google@example.com",
        password: null,
        name: "구글유저",
        googleSub: "sub-1",
        profileImage: null,
      });

      await expect(
        userService.deleteAccount(2, {
          emailConfirm: "other@example.com",
          phrase: WITHDRAWAL_PHRASE,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
      expect(mockUserRepo.deleteById).not.toHaveBeenCalled();
    });
  });
});
