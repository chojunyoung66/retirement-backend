import type { IUserRepo } from "../contracts/user-repo.contract.js";
import { createUserService } from "./user.service.js";

describe("UserService", () => {
  let userService: ReturnType<typeof createUserService>;
  let mockUserRepo: Partial<IUserRepo>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockUserRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    userService = createUserService(mockUserRepo as IUserRepo);
  });

  describe("getProfile", () => {
    it("해피패스: userId로 사용자 정보를 조회", async () => {
      // given
      const userId = 1;
      const expectedUser = {
        id: userId,
        email: "test@example.com",
        name: "테스트유저",
      };

      (mockUserRepo.findById as jest.Mock).mockResolvedValueOnce(expectedUser);

      // when
      const result = await userService.getProfile(userId);

      // then
      expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedUser);
      // 반환 DTO에 password 필드가 없어야 함 (보안)
      expect(result).not.toHaveProperty("password");
      expect(Object.keys(result).sort()).toEqual(["email", "id", "name"]);
    });

    it("존재하지 않는 userId로 조회 시 USER_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 9999;

      (mockUserRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(userService.getProfile(userId)).rejects.toMatchObject({
        code: "USER_NOT_FOUND",
        statusCode: 404,
      });

      // 존재하지 않는 사용자는 조회하려고만 시도
      expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
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

      // when
      const result = await userService.updateProfile(userId, { name: newName });

      // then
      expect(mockUserRepo.update).toHaveBeenCalledWith(userId, { name: newName });
      expect(result).toEqual(updatedUser);
      // 반환 DTO에 password 필드가 없어야 함 (보안)
      expect(result).not.toHaveProperty("password");
      expect(Object.keys(result).sort()).toEqual(["email", "id", "name"]);
    });

    it("해피패스: 사용자 비밀번호를 업데이트", async () => {
      // given
      const userId = 1;
      const newPassword = "newpassword123";
      const updatedUser = {
        id: userId,
        email: "test@example.com",
        name: "테스트유저",
      };

      (mockUserRepo.update as jest.Mock).mockResolvedValueOnce(updatedUser);

      // when
      const result = await userService.updateProfile(userId, { password: newPassword });

      // then
      expect(mockUserRepo.update).toHaveBeenCalledWith(userId, { password: newPassword });
      expect(result).toEqual(updatedUser);
      // 반환 DTO에 password 필드가 없어야 함 (보안)
      expect(result).not.toHaveProperty("password");
      expect(Object.keys(result).sort()).toEqual(["email", "id", "name"]);
    });

    it("업데이트할 필드가 없을 때({}) INVALID_UPDATE 예외 발생", async () => {
      // given
      const userId = 1;
      const emptyData = {};

      // when & then
      await expect(userService.updateProfile(userId, emptyData)).rejects.toMatchObject({
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
      await expect(userService.updateProfile(userId, dataWithEmptyName)).rejects.toMatchObject({
        code: "INVALID_UPDATE",
        statusCode: 400,
      });

      // 사전 검증 실패로 repo.update는 호출되지 않음
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });
});